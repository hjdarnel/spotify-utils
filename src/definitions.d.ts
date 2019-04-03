/* tslint:disable */

/*
* Type definition extensions
*/

declare module 'spotify-web-api-node' {
    interface SpotifyWebApiStatic {
        new (obj: ConstructorParams): SpotifyWebApiInstance;
    }
    interface SpotifyWebApiInstance {
        new (): any;
        createAuthorizeURL(scopes: string[], state: string): string;
        authorizationCodeGrant(authorizationCode: string): Promise<{ body: AuthCodeGrant }>;
        setAccessToken(token: string): void;
        refreshAccessToken(): Promise<{ body: AccessTokenRefresh }>;
        setRefreshToken(token: string): void;

        getMyCurrentPlayingTrack({}): Promise<{ body: CurrentlyPlayingTrack }>;
        getMyRecentlyPlayedTracks({}): Promise<{ body: PlayHistoryObject }>;
        addTracksToPlaylist(id: string, songUri: string[]): Promise<{ snapshot_id: string }>;
    }

    type PlayHistoryObject = {
        items: any
    };

    type CurrentlyPlayingTrack = {
        context: Context;
        timestamp: number;
        progress_ms: number | null;
        is_playing: boolean;
        item: FullTrackObject | null;
        currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
    };

    type Context = {} | null;

    type AccessTokenRefresh = {
        access_token: string;
        token_type: 'Bearer';
        scope: string;
        expires_in: number;
        refresh_token: string;
    };

    type AuthCodeGrant = {
        access_token: string;
        token_type: 'Bearer';
        scope: string;
        expires_in: number;
        refresh_token: string;
    };

    type FullTrackObject = {
        name: string;
        uri: string;
    };

    type ConstructorParams = {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };

    let SpotifyWebApi: SpotifyWebApiStatic;

    export = SpotifyWebApi;
}
