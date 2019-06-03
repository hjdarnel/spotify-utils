require('dotenv-safe').config();
import { send } from 'micro';
import { router, get, post } from 'microrouter';
import { createLogger } from 'bunyan';
import * as SpotifyWebApi from 'spotify-web-api-node';

const logger = createLogger({
    name: 'spotify',
    level: 'debug'
});

const CLIENTID = process.env.CLIENTID;
const CLIENTSECRET = process.env.CLIENTSECRET;

if (!CLIENTID || !CLIENTSECRET) {
    throw Error('No client ID or client secret found');
}

const scopes = [
    'user-read-currently-playing',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-recently-played'
];
const state = 'some-state-of-my-choice';
const spotifyApi = new SpotifyWebApi({
    clientId: CLIENTID,
    clientSecret: CLIENTSECRET,
    redirectUri:
        process.env.ENVIRONMENT === 'TEST'
            ? 'https://4c9b0918.ngrok.io/callback'
            : 'https://spotify-util.darnell.io/callback'
});

const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
logger.info(authorizeURL);

// default playlist, is public
let playlistId = '1ju0e3qeC1TnAfVHWHwvNM';

const callback = async (req: any, res: any) => {
    const query = req.query;
    try {
        const { body } = await spotifyApi.authorizationCodeGrant(query.code);
        // Set the access token on the API object to use it in later calls
        spotifyApi.setAccessToken(body.access_token);
        spotifyApi.setRefreshToken(body.refresh_token);
        logger.info('Authenticated');
    } catch (err) {
        logger.info('Something went wrong with auth!', err);
    }
};

const refreshToken = async () => {
    try {
        const { body } = await spotifyApi.refreshAccessToken();
        logger.info('The access token has been refreshed!');
        spotifyApi.setAccessToken(body.access_token);
    } catch (err) {
        logger.warn('Cannot refresh access token', err);
        throw Error('Cannot refresh access token');
    }
};

const respond = async (req: any, res: any) => {
    try {
        await addSongToPlaylist();
        send(res, 200, 'Added song to playlist.');
    } catch (err) {
        if (err.statusCode === 401) {
            await refreshToken();
            await addSongToPlaylist();
            send(res, 200, 'Added song to playlist.');
        } else {
            send(res, 400, err.message);
        }
    }
};

const addSongToPlaylist = async (playlist?: string): Promise<any> => {
    let songUri: any;
    songUri = await getCurrentSong().catch(async e => {
        if (e.message === 'No track playing') {
            return await getLastSong();
        }
    });
    return await addTracksToPlaylist(songUri, playlist);
};

const getCurrentSong = async (): Promise<string[]> => {
    const data = await spotifyApi.getMyCurrentPlayingTrack({});
    if (data.body.is_playing !== true) {
        logger.info('Request received, no track playing');
        throw Error('No track playing');
    }
    return [data.body.item.uri];
};

const getLastSong = async (): Promise<string[]> => {
    try {
        const data = await spotifyApi.getMyRecentlyPlayedTracks({});
        if (!data.body || data.body.items.length === 0) {
            logger.info('Request received, no track history');
            throw Error('No track history');
        }
        return [data.body.items[0].track.uri];
    } catch (err) {
        logger.warn('Error getting track history', err);
        throw err;
    }
};

const addTracksToPlaylist = async (songUri: string[], id?: string): Promise<any> => {
    try {
        if (id) {
            return await spotifyApi.addTracksToPlaylist(id, songUri);
        }
        return await spotifyApi.addTracksToPlaylist(playlistId, songUri);
    } catch (err) {
        logger.warn('Error adding track to playlist', err);
        throw err;
    } finally {
        if (id) {
            logger.info(`Added song ${songUri} to playlist ${id}`);
        } else {
            logger.info(`Added song ${songUri} to playlist ${playlistId}`);
        }
    }
};

const playlist = async (req: any, res: any): Promise<any> => {
    if (!req.params.id) {
        throw Error('No id given');
    }
    playlistId = req.params.id;
    logger.info(`Set playlistId to ${playlistId}`);
    return `Set playlistId to ${playlistId}`;
};

export default router(
    post('/', respond),
    post('/add', respond),
    post('/add/playlist/:id', respond),
    post('/playlist/:id', playlist),
    get('/callback', callback)
);
