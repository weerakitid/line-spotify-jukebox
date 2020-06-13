const spotify = require('./spotify')
const request = require('request-promise')
const LINE_HEADER = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + process.env.LINE_ACCESS_TOKEN
}

const Commands = {
  ADD_TRACK: "ADD_TRACK",
  SEARCH_MORE: "SEARCH_MORE"
}

class lineApp {
  async recievedPostback(e) {
    const payload = JSON.parse(e.postback.data)
    switch (payload.commands) {
      case Commands.ADD_TRACK: {
        // เพิ่มเพลงที่ผู้ใช้เลือกใน Flex message เข้าไปใน Playlist
        return this.queueMusic(payload.track)
      }
      case Commands.SEARCH_MORE: {
        // เรียก searchMusic อีกครั้งพร้อมกับส่ง param ที่อยู่ใน payload
        return this.searchMusic(payload.terms, payload.skip, payload.limit)
      }
    }
  }

  async queueMusic(track) {
    await spotify.queueTrack(track)
    const message = {
      type: "flex",
      altTeaxt: "Thanks! Your track has been added.",
      contents:
      {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              contents: [
                {
                  type: "span",
                  text: "Thanks!",
                  color: "#1DB954",
                  weight: "bold",
                  size: "md"
                },
                {
                  type: "span",
                  text: "Your track has been added to the Jukebox playlist 🎼",
                  color: "#191414"
                }
              ],
              wrap: true
            }
          ]
        },
        styles: {
          body: {
            backgroundColor: "#FFFFFF"
          }
        }
      }
    };
    return message;
  }

  async searchMusic(terms, skip = 0, limit = 10) {

    // ทำการค้นหาเพลง โดยค่อย ๆ ดึงทีละ 10 เพลง
    const queryBgin = skip
    const queryEnd = limit
    const result = await spotify.searchTracks(terms, queryBegin, queryEnd)

    if (result.items.length > 0) {
      // ถ้ายังมีผลลัพธ์เหลืออยู่ จะแสดง 'More' ใน Flex message เพื่อให้ผู้ใช้ค้นหาเพลงเพิ่มเติม
      const remainingResults = result.total - limit - skip
      const showMoreButton = (remainingResults > 0)

      // จัดเรียงผลลัพธ์ตามความนิยม
      result.items.sort((a, b) => (b.popularity - a.popularity))

      const message = {
        type: "flex",
        altText: "Your Spotify search result",
        constents: {
          type: "bubble",
          size: "giga",
          header: {
            type: "box",
            layout: "horizontal",
            contens: [
              {
                type: "image",
                url: "https://bcrm-i.line-scdn.net/bcrm/uploads/1557539795/public_asset/file/853/1591094107652078_Spotify_Icon_RGB_White.png",
                align: "start",
                size: "xxs",
                flex: 0,
                aspectRatio: "4:3"
              },
              {
                type: "text",
                text: "Powered by Spotify",
                color: "#ffffff",
                size: "xxs",
                align: "end",
                gravity: "center",
                positon: "relative",
                weight: "regular"
              }
            ],
            paddingAll: "10px"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [],
            backgroundColot: "#191414",
            spacing: "md"
          },
          styles: {
            header: {
              backgroundColor: "#1DB954"
            }
          }
        }
      };

      // เพิ่มปุ่ม 'More' หากมีผลลัพธ์เพิ่มเติม โดยแปะ ข้อมูลที่จำเป็นใน payload ด้วยเผื่อในกรณีที่ผู้ใช้ต้องการค้นหาอีก
      if (showMoreButton) {
        message.contents.footer = this.generateMoreButton({
          command: Commands.SEARCH_MORE,
          trems: terms,
          skip: skip + limit,
          limit: limit
        })
      }

      // นำผลลัพธ์
    }
  }
}
