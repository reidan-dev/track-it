"""Thin synchronous Telegram Bot API client.

Every call takes the bot `token` explicitly because track.it is multi-tenant:
each user brings their own bot, so there is no single global token. All calls
swallow network errors (logging a warning) and return either the parsed
`result` payload or None — callers treat None as "send failed", never crash.
"""
import logging

import httpx

logger = logging.getLogger("trackit.telegram")

_BASE = "https://api.telegram.org/bot{token}/{method}"
_FILE = "https://api.telegram.org/file/bot{token}/{path}"


def _call(token: str, method: str, payload: dict | None = None):
    url = _BASE.format(token=token, method=method)
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, json=payload or {})
        data = resp.json()
        if not data.get("ok"):
            logger.warning("Telegram %s failed: %s", method, data.get("description"))
            return None
        return data.get("result")
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Telegram %s error: %s", method, exc)
        return None


def send_message(token, chat_id, text, reply_markup=None, parse_mode=None,
                 disable_web_page_preview=True):
    payload = {"chat_id": chat_id, "text": text,
               "disable_web_page_preview": disable_web_page_preview}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode:
        payload["parse_mode"] = parse_mode
    return _call(token, "sendMessage", payload)


def edit_message_text(token, chat_id, message_id, text, reply_markup=None, parse_mode=None):
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text,
               "disable_web_page_preview": True}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode:
        payload["parse_mode"] = parse_mode
    return _call(token, "editMessageText", payload)


def edit_message_reply_markup(token, chat_id, message_id, reply_markup):
    return _call(token, "editMessageReplyMarkup", {
        "chat_id": chat_id, "message_id": message_id, "reply_markup": reply_markup,
    })


def answer_callback_query(token, callback_query_id, text=None, show_alert=False):
    payload = {"callback_query_id": callback_query_id, "show_alert": show_alert}
    if text:
        payload["text"] = text
    return _call(token, "answerCallbackQuery", payload)


def send_chat_action(token, chat_id, action="typing"):
    return _call(token, "sendChatAction", {"chat_id": chat_id, "action": action})


def set_my_commands(token, commands):
    """commands: list of {"command": "add", "description": "..."}"""
    return _call(token, "setMyCommands", {"commands": commands})


def set_webhook(token, url, secret_token):
    return _call(token, "setWebhook", {
        "url": url,
        "secret_token": secret_token,
        "allowed_updates": ["message", "callback_query"],
        "drop_pending_updates": True,
    })


def delete_webhook(token):
    return _call(token, "deleteWebhook", {"drop_pending_updates": False})


def get_me(token):
    return _call(token, "getMe")


def get_file(token, file_id):
    """Returns the file metadata dict (has 'file_path'), or None."""
    return _call(token, "getFile", {"file_id": file_id})


def download_file(token, file_path) -> bytes | None:
    url = _FILE.format(token=token, path=file_path)
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(url)
        if resp.status_code != 200:
            logger.warning("Telegram file download failed: %s", resp.status_code)
            return None
        return resp.content
    except httpx.HTTPError as exc:
        logger.warning("Telegram file download error: %s", exc)
        return None
