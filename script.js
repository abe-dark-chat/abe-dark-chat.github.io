const SUPABASE_URL = "https://udfcujfonvdrqdbfaymq.supabase.co";
const SUPABASE_KEY = "sb_publishable_0xjubcQxiErhInQWyt6lXg_XxOto4wf";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const messageForm = document.getElementById('message-form');
const msgInput = document.getElementById('msg-input');
const chatBox = document.getElementById('chat-box');
const userList = document.getElementById('user-list');
const emojiTrigger = document.getElementById('emoji-trigger');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

// 1. Setup Chat Username Caching
let myUsername = localStorage.getItem('shadow_username');
if (!myUsername) {
    myUsername = prompt("Enter your chat handle (e.g., Guest_99):") || "Guest_" + Math.floor(Math.random() * 1000);
    myUsername = myUsername.trim();
    localStorage.setItem('shadow_username', myUsername);
}

// 2. Custom Curated Emoji Sets
const emojiCategories = {
    "Classic": ["😂", "🔥", "😎", "🥺", "💀", "👾", "👀", "🤫", "💯", "👑", "👍", "🤝"],
    "Reaction": ["⚡", "💥", "🚀", "🎮", "🌟", "✨", "❤️", "💎", "🚨", "⚠️", "❌", "✅"]
};

// 3. Slide-out Navigation for Mobiles
if (menuToggle && sidebar) {
    menuToggle.onclick = (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
        menuToggle.classList.toggle('active');
    };

    // Close menu when tapping anywhere inside the main chat view
    document.querySelector('.chat-area').onclick = () => {
        sidebar.classList.remove('active');
        menuToggle.classList.remove('active');
    };
}

// 4. Load messages from DB
async function loadMessages() {
    const { data: messages, error } = await db
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(60);

    if (error) {
        console.error("Database connection error:", error);
        return;
    }

    chatBox.innerHTML = ''; 
    messages.forEach(msg => renderMessage(msg));
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 5. Render message bubble layout
function renderMessage(msg) {
    const msgDiv = document.createElement('div');
    if (msg.username === myUsername) {
        msgDiv.classList.add('message', 'outgoing');
    } else {
        msgDiv.classList.add('message', 'incoming');
    }

    msgDiv.innerHTML = `
        <span class="sender">${escapeHTML(msg.username)}</span>
        <span class="msg-text">${escapeHTML(msg.text)}</span>
    `;
    chatBox.appendChild(msgDiv);
}

// Clean HTML to block script injection / hacking
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// 6. Push message input to DB
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (text === '') return;

    msgInput.value = ''; // Instantly clear text bar
    msgInput.focus();

    const { error } = await db
        .from('messages')
        .insert([{ username: myUsername, text: text }]);

    if (error) {
         console.error("Message send failure:", error);
    }
});

// 7. Initialize Realtime Channels & Presence state
const channel = db.channel('main-lounge', {
    config: {
        presence: { key: myUsername }
    }
});

channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
    renderMessage(payload.new);
    chatBox.scrollTop = chatBox.scrollHeight;
});

channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    userList.innerHTML = '';
    
    Object.keys(state).forEach(username => {
        const userDiv = document.createElement('div');
        userDiv.className = "user-item";
        userDiv.innerHTML = `<span class="user-status-dot"></span> <span>${escapeHTML(username)}</span>`;
        userList.appendChild(userDiv);
    });
});

channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
    }
});

// 8. Mobile-Responsive Custom Emoji Picker
const picker = document.createElement('div');
picker.className = 'emoji-picker';
document.body.appendChild(picker);

picker.innerHTML = `
    <div class="emoji-categories">
        <button class="category-tab active" data-cat="Classic">Classic</button>
        <button class="category-tab" data-cat="Reaction">Reactions</button>
    </div>
    <div class="emoji-grid" id="emoji-grid"></div>
`;

const grid = picker.querySelector('#emoji-grid');
const tabs = picker.querySelectorAll('.category-tab');

function renderCategory(cat) {
    grid.innerHTML = '';
    emojiCategories[cat].forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-item';
        btn.innerText = emoji;
        btn.onclick = () => {
            msgInput.value += emoji;
            picker.style.display = 'none';
            msgInput.focus();
        };
        grid.appendChild(btn);
    });
}

tabs.forEach(tab => {
    tab.onclick = (e) => {
        e.stopPropagation();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderCategory(tab.dataset.cat);
    };
});

emojiTrigger.onclick = (e) => {
    e.stopPropagation();
    const isOpened = picker.style.display === 'flex';
    picker.style.display = isOpened ? 'none' : 'flex';
    if (!isOpened) renderCategory("Classic");
};

document.addEventListener('click', () => picker.style.display = 'none');
picker.addEventListener('click', (e) => e.stopPropagation());

// Start app processes
loadMessages();