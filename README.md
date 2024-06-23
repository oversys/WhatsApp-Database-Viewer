# Whatsapp Database Viewer

Tool used to view `msgstore.db` (crypt15 E2EE backup only) through a WhatsApp Web (dark theme) like interface.

*Note: This tool relies on Flask for the backend so make sure you have it installed.*
`pip3 install -r requirements.txt`

## Guide
* Retrieve `msgstore.db` using [WhatsApp Crypt Tools](https://github.com/ElDavoo/wa-crypt-tools)
* Paste `msgstore.db` in same directory as `app.py`
* (Optional) Paste `Media` directory from `Android/media/com.whatsapp/WhatsApp/` in same directory as `app.py`
* Run `python3 app.py`
* Open `http://127.0.0.1:5000/` in your browser

## Features
- [x] Indicate forwarded, edited, starred messages
- [x] Indicate deleted messages (deleted by you, other, admin)
- [x] Show quoted messages
- [x] Show media
- [x] Show calls with duration
- [x] Show system messages
- [x] Display thumbnails from database
- [ ] Show reactions
- [ ] Show polls
- [ ] Style audio and video players like WhatsApp Web
- [ ] Style calls like WhatsApp app (not visible in WhatsApp Web)
- [ ] Assign unique color to each group participant
- [ ] Search for message
- [ ] Click on quoted message to jump to it
- [ ] Open starred messages list
- [ ] Click on message in starred messages list to jump to it
- [ ] Click on image to enlarge it
- [ ] Add support for user avatars and group icons (not possible currently since my phone is not rooted)
- [ ] Get names from `wa.db` (not possible currently since my `wa.db` has no records, only empty tables)
- [ ] Find a way to know if user left or joined group since there is no distinction in `msgstore.db`
- [ ] Probably a lot of other things that I can't remember

## Known Issues
- Overflowing last message text (text-overflow: ellipsis doesn't work with display: flex)
- Scrollbar going behind #top-bar
- After reaching beginning of chat, other chats do not load (temp solution: refresh page)

## Pull Requests
Pull requests to fix bugs, implement features, or clean up bad code are welcome and highly appreciated.

## Credits
* [WhatsApp Web](https://web.whatsapp.com) - All SVGs, Google Maps API calls, and [favicon](https://web.whatsapp.com/favicon-64x64.ico)
* [Apple Fonts](https://gist.github.com/nonaybay/684d1808c0eb9be67063c3f6fb2785c6)
* [Whatsapp Clone](https://github.com/6wki/WhatsApp-Clone/tree/master/img) - Background
* [WhatsApp Exporter](https://github.com/chrrel/whatsapp-exporter) - Message types
* [URL Detection Regex](https://stackoverflow.com/a/8943487)
* [ChatGPT](https://chatgpt.com/) - Weird dictionary comprehension and other stuff :)
