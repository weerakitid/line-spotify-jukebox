const SpotifyWebApi = require('spotify-web-api-node')

class Spotify {
  constructor() {
    // init การเชื่อมต่อกับ spotify
    this.api = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_CALLBACK
    });

    // สร้าง Login url เพื่อสามารถเข้าถึงสิทธิต่าง ๆ ของเครื่องหลักที่ต่อลำโพง
    const scopes = ['playlist-read-private', 'playlist-modify', 'playlist-modify-private']
    const authorizeUrl = this.api.createAuthorizeURL(scopes, 'default-state')
    console.log(`Authorization required. Please visit ${authorizeUrl}`)
  }

  isAuthTokenValid() {
    if (this.auth == undefined || this.auth.expired_at == undefined) {
      return false
    } else if (this.auth.expired_at < new Date) {
      return false
    }
    return true
  }

  async initialized() {
    const playlists = []

    const limit = 50
    let offset = -limit
    let total = 0

    // ทำการ Download Playlist ทั้งหมดจาก spotify ของผู้ใช้ที่ได้ login เก็บไว้ในตัวแปร playlists
    do {
      offset += limit
      const result = await this.api.getUserPlaylists(undefined, { offset: offset, limit: 50 })
      total = result.body.total

      const subset = result.body.items.map(playlist => {
        return { id: playlist.id, name: playlist.name }
      })
      playlist.push(...subset)
    } while ((offset + limit) < total)

    // ทำการค้นหา Playlist ที่ชื่อว่า Jukebox (ตาม .env)
    // ถ้าไม่เจอ ให้สร้าง playlist ใหม่
    const index = playlists.findIndex(playlist => playlist.name === process.env.SPOTIFY_PLAYLIST_NAME)
    if (index >= 0) {
      this.playlist = playlists[index].id
    } else {
      let result
      await this.api.createPlaylist(process.env.SPOTIFY_USER_ID, process.env.SPOTIFY_PLAYLIST_NAME, { public: false })
        .then(data => {
          result = data.body.id
          console.log(`Created Jukebox playlist! ${result}`)
        }, err => {
          console.log('Something went wrong!', err)
        })
      this.playlist = result
    }
    console.log('Spotify is ready!')
  }

  async refreshAuthToken() {
    const result = await this.api.refreshAccessToken()

    const expiredAt = new Date
    expiredAt.setSeconds(expiredAt.getSeconds() + result.body.expired_in)
    this.settings.auth.access_token = result.body.access_token
    this.settings.auth.expires_at = expiredAt

    this.api.setAccessToken(result.body.access_token)
  }

  async receivedAuthCode(authCode) {
    // ได้รับ Authorization code ตอนที่ call back url ถูกเรียก
    // จากนั้นเอา code นี้ไปรับ access token กับ refresh token อีกที
    const authFlow = await this.api.authorizationCodeGrant(authCode)
    this.auth = authFlow.body

    // เก็บค่า expires time ไว้ใช้ตอนเรียก refresh token
    const expiresAt = new Date
    expiresAt.setSeconds(expiresAt.getSeconds() + authFlow.body.expires_in)
    this.auth.expires_at = expiresAt

    // ส่งค่า tokens ทั้งสองให้กับ lib ของ spotify
    this.api.setAccessToken(this.auth.access_token)
    this.api.setRefreshToken(this.auth.refresh_token)

    // เริ่มทำการ init การเชื่อมต่อกับ spotify
    this.initialized()
  }

  async searchTracks(terms, skip = 0, limit = 10) {
    if (!this.isAuthTokenValid()) {
      await this.refreshAuthToken()
    }

    const result = await this.api.searchTracks(terms, { offset: skip, limit: limit })
    return result.body.tracks
  }

  async queueTrack(track) {
    if (!this.isAuthTokenValid()) {
      await this.refreshAccessToken()
    }
    return this.api.addTracksToPlaylist(this.playlist, [`spotify:track:${track}`])
  }
}
