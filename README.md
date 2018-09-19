# Spotify Utils
A quick server to handle operations to Spotify's web api, written with [zeit's Micro server](https://github.com/zeit/micro)

Leverages the Spotify Web API, using [@thelinmichael's NodeJS wrapper](https://github.com/thelinmichael/spotify-web-api-node)

Exposes the following routes on port 80 (probably bad practice 😬)

```
GET  /callback           -- redirect route for Spotify user authentication
POST /                   -- add currently playing track to selected playlist
POST /add                -- add currently playing track to selected playlist (same as ☝)
POST /add/playlist/:id   -- add currently track to playlist with id
POST /playlist/:id       -- change the default playlist to add tracks
```
