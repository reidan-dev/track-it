"""Telegram keyboard builders and the labels that drive the reply menu."""

# Reply-keyboard button labels. The message handler maps these exact strings to
# flows, so keep them in sync with main_menu() below.
BTN_EXPENSE = "➕ Expense"
BTN_INCOME = "➕ Income"
BTN_DUE = "📅 Due"
BTN_BALANCES = "💰 Balances"
BTN_SPENT = "📊 Spent"
BTN_LEND = "🤝 Lend/Borrow"


def main_menu():
    """Persistent reply keyboard docked at the bottom of the chat."""
    return {
        "keyboard": [
            [{"text": BTN_EXPENSE}, {"text": BTN_INCOME}],
            [{"text": BTN_DUE}, {"text": BTN_BALANCES}],
            [{"text": BTN_SPENT}, {"text": BTN_LEND}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


def inline(rows):
    """Wrap rows of [(label, callback_data), ...] into an inline keyboard."""
    return {
        "inline_keyboard": [
            [{"text": label, "callback_data": data} for label, data in row]
            for row in rows
        ]
    }


def cancel_row():
    return [("✖️ Cancel", "cancel")]


# Slash menu registered via setMyCommands.
COMMANDS = [
    {"command": "start", "description": "Link this chat & show the menu"},
    {"command": "add", "description": "Add an expense"},
    {"command": "income", "description": "Add income"},
    {"command": "due", "description": "What's due this period"},
    {"command": "balances", "description": "Who owes who"},
    {"command": "spent", "description": "Spending summary"},
    {"command": "lend", "description": "Record a loan / IOU"},
    {"command": "cancel", "description": "Cancel the current action"},
    {"command": "help", "description": "How to use this bot"},
]
