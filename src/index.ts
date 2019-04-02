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

const scopes = ['user-read-currently-playing', 'playlist-modify-public', 'playlist-modify-private'];
const state = 'some-state-of-my-choice';
const spotifyApi = new SpotifyWebApi({
    clientId: CLIENTID,
    clientSecret: CLIENTSECRET,
    redirectUri: 'https://spotify-util.darnell.io/callback'
});

const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
logger.info(authorizeURL);

// default playlist, is public
let playlistId = '4GsTcyIUqXc5edk1D1ieSr';

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
        await spotifyApi.setAccessToken(body.access_token);
    } catch (err) {
        logger.warn('Cannot refresh access token', err);
        throw Error('Cannot refresh access token');
    }
};

const respond = async (req: any, res: any) => {
    try {
        await addSongToPlaylist();
        send(res, 200, 'OK');
    } catch (err) {
        if (err.statusCode === 401) {
            await refreshToken();
            await addSongToPlaylist();
            send(res, 200, 'OK');
        } else {
            send(res, 400, err.message);
        }
    }
};

const addSongToPlaylist = async (playlist?: string): Promise<any> => {
    try {
        const songUri = await getCurrentSong();
        return await addTracksToPlaylist(songUri, playlist);
    } catch (err) {
        throw err;
    }
};

const getCurrentSong = async (): Promise<any> => {
    try {
        const data = await spotifyApi.getMyCurrentPlayingTrack({});
        if (data.body.is_playing !== true) {
            logger.info('Request received, no track playing');
            throw Error('No track playing');
        }
        return [data.body.item.uri];
    } catch (err) {
        logger.warn('Error getting current song', err);
        throw err;
    }
};

const addTracksToPlaylist = async (songUri: string[], id?: string): Promise<any> => {
    try {
        if (id) {
            logger.info(`Adding song ${songUri} to playlist ${id}`);
            return await spotifyApi.addTracksToPlaylist(id, songUri);
        }
        logger.info(`Adding song ${songUri} to playlist ${playlistId}`);
        return await spotifyApi.addTracksToPlaylist(playlistId, songUri);
    } catch (err) {
        logger.warn('Error adding track to playlist', err);
        throw err;
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
