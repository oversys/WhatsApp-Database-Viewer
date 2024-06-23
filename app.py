from flask import Flask, render_template, request, jsonify, send_from_directory
import sqlite3
import base64

app = Flask(__name__)

def query_db(query):
    conn = sqlite3.connect("msgstore.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(query)
    result = cursor.fetchall()
    conn.close()

    return result

def get_chats():
    query = """
        SELECT
            chat._id,
            chat.jid_row_id,
            CASE
                WHEN chat.subject IS NOT NULL THEN chat.subject
                ELSE jid.user
            END
        FROM chat
        JOIN jid ON chat.jid_row_id = jid._id
        WHERE chat.hidden = 0
        ORDER BY chat.sort_timestamp DESC
    """

    return query_db(query)

def query_chat_info(chat_id):
    chat_info = query_db(f"SELECT chat.subject, jid.user FROM chat JOIN jid ON chat.jid_row_id = jid._id WHERE chat._id = {chat_id}")

    query = f"""
        SELECT jid.user
        FROM group_participant_user participants
        JOIN jid ON participants.user_jid_row_id = jid._id
        JOIN chat ON participants.group_jid_row_id = chat.jid_row_id
        WHERE chat._id = {chat_id}
    """

    participants = query_db(query)
    participants = [participant["user"] for participant in participants]

    query = f"""
        SELECT jid.user
        FROM group_past_participant_user past_participants
        JOIN jid ON past_participants.user_jid_row_id = jid._id
        JOIN chat ON past_participants.group_jid_row_id = chat.jid_row_id
        WHERE chat._id = {chat_id}
    """

    past_participants = query_db(query)
    past_participants = [past_participant["user"] for past_participant in past_participants]

    is_group = True if chat_info[0][0] else False

    return [is_group, chat_info[0][0] if is_group else chat_info[0][1], participants, past_participants]

def get_messages(chat_id, limit=1000, offset=0):
    query = f"""
        SELECT 
            CASE
                WHEN msg.sender_jid_row_id = 0 THEN (SELECT user FROM jid WHERE _id = chat.jid_row_id)
                ELSE jid.user
            END as user,
            msg.from_me, msg.starred,
            CASE
                WHEN msg.message_type = 7 THEN CASE
                    WHEN old_jid.user IS NOT NULL THEN old_jid.user || " changed to " || new_jid.user
                    WHEN joined_jid.user IS NOT NULL THEN joined_jid.user || " was added/removed"
                    ELSE "System Message"
                END
                ELSE msg.text_data
            END as text_data,
            message_revoked.revoked_key_id,
            admin_jid.user as admin_user,
            COALESCE(media.file_path, media.mime_type) as media,
            msg.message_type,
            location.latitude,
            location.longitude,
            location.place_name,
            location.place_address,
            quoted.text_data as quoted_text_data,
            quoted_jid.user as quoted_user,
            msg.timestamp,
            thumbnail.thumbnail,
            forwarded.forward_score,
            edit_info.edited_timestamp,
            -- GROUP_CONCAT(reaction.reaction,  ' ') AS reactions,
            call_log.duration
        FROM message msg
        LEFT JOIN jid ON msg.sender_jid_row_id = jid._id
        LEFT JOIN message_media media ON msg._id = media.message_row_id
        LEFT JOIN message_thumbnail thumbnail ON msg._id = thumbnail.message_row_id
        LEFT JOIN message_revoked ON msg._id = message_revoked.message_row_id
        LEFT JOIN jid AS admin_jid ON message_revoked.admin_jid_row_id = admin_jid._id
        LEFT JOIN message_location location ON msg._id = location.message_row_id
        LEFT JOIN message_quoted quoted ON msg._id = quoted.message_row_id
        LEFT JOIN jid AS quoted_jid ON quoted.sender_jid_row_id = quoted_jid._id
        LEFT JOIN message_system_number_change system_numchange ON msg._id = system_numchange.message_row_id
        LEFT JOIN jid AS old_jid ON system_numchange.old_jid_row_id = old_jid._id
        LEFT JOIN jid AS new_jid ON system_numchange.new_jid_row_id = new_jid._id
        LEFT JOIN message_system_chat_participant system_chat_participant ON msg._id = system_chat_participant.message_row_id
        LEFT JOIN jid AS joined_jid ON system_chat_participant.user_jid_row_id = joined_jid._id
        LEFT JOIN message_forwarded forwarded ON msg._id = forwarded.message_row_id
        LEFT JOIN message_edit_info edit_info ON msg._id = edit_info.message_row_id
        -- LEFT JOIN message_add_on add_on ON msg._id = add_on.parent_message_row_id
        -- LEFT JOIN message_add_on_reaction reaction ON add_on._id = reaction.message_add_on_row_id
        -- LEFT JOIN jid AS reacted_jid ON add_on.sender_jid_row_id = jid._id
        LEFT JOIN message_call_log ON msg._id = message_call_log.message_row_id
        LEFT JOIN call_log ON message_call_log.call_log_row_id = call_log._id
        LEFT JOIN chat ON msg.chat_row_id = chat._id
        WHERE msg.chat_row_id = {chat_id}
        -- GROUP BY msg.text_data
        ORDER BY msg._id DESC
        LIMIT {limit}
        OFFSET {offset}
    """

    messages = query_db(query)
    messages.reverse()
    messages = [{
        **message,
        "thumbnail": base64.b64encode(message["thumbnail"]).decode() if isinstance(message["thumbnail"], bytes) else message["thumbnail"],
        # "reactions": message["reactions"].split() if message["reactions"] else []
    } for message in messages]

    return messages

def get_last_message(chat_id):
    query = f"""
        SELECT jid.user, COALESCE(msg.text_data, location.place_name || " " || location.place_address), msg.message_type, msg.timestamp
        FROM message msg
        LEFT JOIN jid ON msg.sender_jid_row_id = jid._id
        LEFT JOIN message_location location ON msg._id = location.message_row_id
        WHERE msg.chat_row_id = {chat_id} AND msg.message_type != 7
        ORDER BY msg._id DESC
        LIMIT 1
    """

    last_message_query = query_db(query)
    if last_message_query:
        last_message_query = last_message_query[0]
        is_group = query_chat_info(chat_id)[0]

        if is_group:
            last_message = [f"{last_message_query[0]}: {last_message_query[1]}", last_message_query[2], last_message_query[3]]
        else:
            last_message = [f"{last_message_query[1]}", last_message_query[2], last_message_query[3]]
    else:
        last_message = ["", None, None]

    return last_message
    
@app.route('/')
def index():
    return render_template('index.html', chats=get_chats())

@app.route('/chat-info/<int:chat_id>')
def get_chat_info(chat_id):
    chat_info = query_chat_info(chat_id)
    return jsonify(chat_info)

@app.route('/messages/<int:chat_id>')
def fetch_messages(chat_id):
    limit = int(request.args.get('limit', 10))
    offset = int(request.args.get('offset', 0))

    messages = get_messages(chat_id, limit, offset)
    return jsonify(messages)

@app.route('/last-message/<int:chat_id>')
def last_message(chat_id):
    last_message = get_last_message(chat_id)

    return jsonify(last_message)

@app.route('/Media/<path:filename>')
def send_media(filename):
    return send_from_directory("Media", filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
