var currentLimit = 1000;
var currentOffset = 0;
var currentChatId = 0;
var isLoading = false;

async function getJSON(url) {
	return await fetch(url)
		.then((response) => response.json())
		.then((responseJSON) => { return responseJSON });
}

document.addEventListener('DOMContentLoaded', async function() {
	document.getElementById("search-icon").innerHTML = searchSVG;

	// infinite scroll
	document.getElementById("messages").addEventListener("scroll", function() {
		if (this.scrollTop == 0) fetchMessages(currentChatId, currentLimit, currentOffset, true);
	});

	const links = document.querySelectorAll('.view-messages');
	for await (const link of links) {
		// TO-DO: add support for custom pfps
		link.querySelector(".chat-avatar").innerHTML = defaultAvatarSVG;

		// fetch data
		const chatId = link.getAttribute('data-chat-id');
		let lastMessageResponse = await getJSON(`/last-message/${chatId}`);

		let lastMessageDiv = document.createElement('div');
		lastMessageDiv.classList.add("chat-last-message");

		// add last message text and appropriate SVG
		const messageTypeMap = {
			0: { text: "", icon: "" },
			1: { text: "Photo", icon: imgSVG },
			2: { text: "Audio", icon: audioSVG },
			3: { text: "Video", icon: videoSVG },
			5: { text: "Location", icon: locationSVG }
		};

		const messageType = lastMessageResponse[1];
		const messageData = messageTypeMap[messageType] || { text: lastMessageResponse[0], icon: "" };
		const lastMessageContent = lastMessageResponse[0] != "None" ? lastMessageResponse[0] : messageData.text;
		lastMessageDiv.innerHTML = `${messageData.icon} ${lastMessageContent}`;
		
		link.querySelector(".chat-details").appendChild(lastMessageDiv);

		// add time div
		let timeDiv = document.createElement('div');
		timeDiv.classList.add("chat-time");

		let date = new Date(lastMessageResponse[2]);
		timeDiv.innerHTML = `${date.toLocaleDateString()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

		link.appendChild(timeDiv);

		// when chat is selected
		link.addEventListener('click', function() {
			// highlight list item
			const prevSelected = document.querySelector('.chat-list li.selected');
			if (prevSelected) prevSelected.classList.remove('selected');
			this.closest('li').classList.add('selected');

			// reset offset
			currentOffset = 0;

			// fetch last 500 messages
			fetchMessages(chatId, currentLimit, currentOffset);
			currentChatId = chatId;
		});
	}
});

// let regex = /((http(s)?(\:\/\/))?(www\.)?([\a-zA-Z0-9-_\.\/])*(\.[a-zA-Z]{2,3}\/?))([\a-zA-Z0-9-_\/?=&#])*(?!(.*a>)|(\'|\"))/g; https://stackoverflow.com/a/23759681
let regex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig; // https://stackoverflow.com/a/8943487

// detect links in text
function linkify(text) {
	return text.replace(regex, url => `<a href="${url}">${url}</a>`);
}

async function fetchMessages(chatId, limit, offset, prepend = false) {
	if (isLoading) return;
	isLoading = true;

	// fetch chat info
	let chatInfo = await getJSON(`/chat-info/${chatId}`);

	let isGroup = chatInfo[0];
	let chatName = chatInfo[1];
	let participants = chatInfo[2];

	// add info in top bar
	document.getElementById('chat-name').innerText = chatName;
	let participantsDiv = document.getElementById('participants');
	participantsDiv.innerHTML = '';

	if (isGroup == true) participantsDiv.innerText = participants.join(', ');

	// fetch messages
	let messages = await getJSON(`/messages/${chatId}?limit=${limit}&offset=${offset}`);

	const messagesContainer = document.getElementById('messages-container');
	if (!prepend) messagesContainer.innerHTML = '';

	if (!messages.length) {
		let startDiv = document.createElement("div");
		startDiv.classList.add("message", "system");
		startDiv.innerHTML = `<p>This is the start of your conversation with ${chatName}</p>`
		messagesContainer.insertBefore(startDiv, messagesContainer.firstChild)
		return;
	}

	let currentDay = 0;
	let previousDay = 0;
	const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	if (prepend) {
		var prependingDiv = document.createElement("div");
		prependingDiv.classList.add("message", "system");
		prependingDiv.innerHTML = `<p>Prepending ${currentLimit} messages with offset ${currentOffset}</p>`
		messagesContainer.insertBefore(prependingDiv, messagesContainer.firstChild)
	}

	messages.forEach(message => {
		// add day and date system message
		let date = new Date(message['timestamp']);
		currentDay = date.getDate();

		if (currentDay != previousDay) {
			const dateDiv = document.createElement('div');
			const dayOfWeek = daysOfWeek[date.getDay()];

			dateDiv.classList.add("message", "system");
			dateDiv.innerHTML = `<p>${dayOfWeek} ${date.toLocaleDateString()}</p>`;

			if (prepend) messagesContainer.insertBefore(dateDiv, prependingDiv);
			else messagesContainer.append(dateDiv)
		}

		previousDay = currentDay;

		// build and add message
		const messageDiv = buildMessage(message, chatInfo);

		if (prepend) messagesContainer.insertBefore(messageDiv, prependingDiv);
		else messagesContainer.append(messageDiv)
	});
	
	// scroll to the end of the messages container
	if (!prepend) messagesContainer.scrollIntoView(false);
	else prependingDiv.scrollIntoView(false);

	currentOffset += limit;
	isLoading = false;
}

function buildMessage(message, chatInfo) {
	// chat info
	let isGroup = chatInfo[0];
	let chatName = chatInfo[1];

	// create message div
	const messageDiv = document.createElement('div');
	let messageContent = "";

	// system message
	if (message['message_type'] == 7){
		messageDiv.classList.add("message", "system");
		messageContent += `<p>${message['text_data']}</p>`;
	
	// user message
	} else {
		senderClass = message['from_me'] ? "sent" : "received";
		messageDiv.classList.add("message", senderClass);

		// add numbers if in group
		if (isGroup && !message['from_me']) messageContent += `<p class="number">${message['user']}</p>`;

		// deleted message
		if (message['revoked_key_id']) {
			message['text_data'] = `${deletedSVG} <span style='color:#667781'><i>`;

			if (message['admin_user']) {
				message['text_data'] += `This message was deleted by admin ${message['admin_user']}`;
			} else if (message['from_me']) {
				message['text_data'] += 'You deleted this message';
			} else {
				message['text_data'] += 'This message was deleted';
			}

			message['text_data'] += '</i></span>';
		}

		// message content
		messageContent += `<p class="text">${linkify(message['text_data'] ? message['text_data'] : '')}</p>`;
		
		// TO-DO: style reactions like Whatsapp Web
		// if (message['reactions']) messageContent += `${message['reactions']}`;

		// TO-DO: Make calls like Whatsapp (not visible on Whatsapp Web)
		if (message['duration'] != null) messageContent += `Call lasted for ${message['duration']}`;
		
		// message time
		let date = new Date(message['timestamp']);

		let timeContent = '';
		if (message['starred']) timeContent += `${starredSVG} `; // starred message
		if (message['edited_timestamp']) timeContent += 'Edited '; // edited message
		
		messageContent += `<p class="time">${timeContent}${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}</p>`;
	}

	// quoted message
	if (message['quoted_user'] == null) message['quoted_user'] = message['from_me'] ? "You" : chatName;

	if (message['quoted_text_data']) messageContent += `<div class="quote"><p class="number">${message['quoted_user']}</p><p class="quote-text">${message['quoted_text_data']}</p></div>`;

	// forwarded message
	if (message['forward_score']) messageContent += `<p class="forwarded text">${forwardedSVG} <span style='color:#667781'><i>Forwarded</i></span></p>`

	// message media 
	switch (message['message_type']) {
		// image
		case 1:
			messageContent += `<img class="media" src="${message['media']}" alt="Image">`;
			break;

		// audio
		case 2:
			messageContent += `<audio controls preload="none"><source src="${message['media']}"></source></audio>`;
			break;

		// video
		case 3:
			messageContent += `<video class="media" controls preload="none"><source src="${message['media']}"></source></video>`;
			break;

		// location
		case 5:
			let locationLink = `https://www.google.com/maps/search/${message['place_name']}/@${message['latitude']},${message['longitude']}`;

			messageContent += `<a rel="noopener noreferrer" href="${locationLink}" target="_blank"><img class="media" src="https://maps.googleapis.com/maps/api/staticmap?zoom=15&amp;size=270x200&amp;scale=1&amp;language=en&amp;client=gme-whatsappinc&amp;markers=color%3Ared%7C${message['latitude']}%2C+${message['longitude']}&amp;style=element:geometry%7Ccolor:0x212121&amp;style=element:labels.icon%7Cvisibility:off&amp;style=element:labels.text.fill%7Ccolor:0x757575&amp;style=element:labels.text.stroke%7Ccolor:0x212121&amp;style=feature:administrative%7Celement:geometry%7Ccolor:0x757575&amp;style=feature:administrative.country%7Celement:labels.text.fill%7Ccolor:0x9e9e9e&amp;style=feature:administrative.land_parcel%7Cvisibility:off&amp;style=feature:administrative.locality%7Celement:labels.text.fill%7Ccolor:0xbdbdbd&amp;style=feature:poi%7Celement:labels.text.fill%7Ccolor:0x757575&amp;style=feature:poi.park%7Celement:geometry%7Ccolor:0x181818&amp;style=feature:poi.park%7Celement:labels.text.fill%7Ccolor:0x616161&amp;style=feature:poi.park%7Celement:labels.text.stroke%7Ccolor:0x1b1b1b&amp;style=feature:road%7Celement:geometry.fill%7Ccolor:0x2c2c2c&amp;style=feature:road%7Celement:labels.text.fill%7Ccolor:0x8a8a8a&amp;style=feature:road.arterial%7Celement:geometry%7Ccolor:0x373737&amp;style=feature:road.highway%7Celement:geometry%7Ccolor:0x3c3c3c&amp;style=feature:road.highway.controlled_access%7Celement:geometry%7Ccolor:0x4e4e4e&amp;style=feature:road.local%7Celement:labels.text.fill%7Ccolor:0x616161&amp;style=feature:transit%7Celement:labels.text.fill%7Ccolor:0x757575&amp;style=feature:water%7Celement:geometry%7Ccolor:0x000000&amp;style=feature:water%7Celement:labels.text.fill%7Ccolor:0x3d3d3d&amp;signature=UuN2bG70uyCiJVwY59jkGVNh2kc" alt="" tabindex="-1" style="pointer-events: none; width: 270px; visibility: visible;"></a>`;

			messageContent += `<p class="text"><a target="_blank" href="${locationLink}">${message['place_name']}</a></p>`
			messageContent += `
				<p class='text'>${message['place_address']}</p>`;
			break;

		// document
		case 9:
			messageContent += `<p class="text"><a href="${message['media']}" target="_blank">${message['media']}</a></p>`;
			console.log("document");
			break;

		// View Once
		case 42:
			messageContent += `<p class="text">${openedSVG} <span style='color:#667781'><i>Opened</i></span></p>`
			break;

		// thumbnail
		default:
			if (message['thumbnail']) messageContent += `<img class="media thumbnail" src="data:image/png;base64,${message['thumbnail']}" alt="Thumbnail">`;
			break;
	}

	messageDiv.innerHTML = messageContent;
	return messageDiv;
}
