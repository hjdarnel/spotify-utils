import { send } from 'micro';
import { router, get, post } from 'microrouter';
import { createLogger } from 'bunyan';
const SpotifyWebApi = require('spotify-web-api-node');

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
    redirectUri: 'https://spotify-util.now.sh/callback'
});

const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
logger.info(authorizeURL);

// default playlist, is public
let playlistId = '4GsTcyIUqXc5edk1D1ieSr';

const callback = async (req: any, res: any) => {
    const query = req.query;
    await spotifyApi.authorizationCodeGrant(query.code).then(
        (data: any) => {
            // Set the access token on the API object to use it in later calls
            spotifyApi.setAccessToken(data.body.access_token);
            spotifyApi.setRefreshToken(data.body.refresh_token);
        },
        (err: any) => {
            logger.info('Something went wrong!', err);
        }
    );
    logger.info('Authenticated');
};

// Todo: refactor all this nastiness
// ? We want to retry once, refreshing the access code first, and then actually fail
// ? if we actually fail, then we should return 500 instead of 200.
const respond = async (req: any, res: any) => {
    try {
        try {
            await addSongToPlaylist(req.params.id);
            send(res, 200, 'OK');
        } catch (err) {
            send(res, 500, err);
        }
    } catch (e) {
        try {
            await spotifyApi.refreshAccessToken().then(
                (data: any) => {
                    logger.info('The access token has been refreshed!');
                    spotifyApi.setAccessToken(data.body.access_token);
                },
                (err: any) => {
                    logger.info('Could not refresh access token', err);
                }
            );
            try {
                await addSongToPlaylist();
                send(res, 200, 'OK');
            } catch (err) {
                send(res, 500, err);
            }
        } catch (err) {
            logger.warn('Cannot refresh access token', err);
            send(res, 500, 'Error saving song');
        }
        logger.info('Error saving song, trying to refresh access token', e);
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
            return;
        }
        return [data.body.item.uri];
    } catch (err) {
        logger.warn('Error getting current song', err);
        throw Error(err);
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
        throw Error(err);
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
