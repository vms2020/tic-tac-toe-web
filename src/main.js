import './style.css'

const games = [
  { id: 'A102', name: 'Friday Night Duel', host: 'Nova', symbol: 'X', status: 'Waiting', viewers: 3 },
  { id: 'A103', name: 'Quick Match', host: 'PixelFox', symbol: 'O', status: 'In progress', viewers: 5 },
  { id: 'A104', name: 'The Last Square', host: 'Mira', symbol: 'X', status: 'In progress', viewers: 2 },
]
let selected = games[0].id
let board = Array(9).fill('')
let turn = 'X'
let signedIn = false
let loginName = 'PlayerOne'
let playersMessages = [{name:'Nova',text:'Good luck! Have fun.'},{name:'PixelFox',text:'That last game was close.'}]
let publicMessages = [{name:'Spectator7',text:'I think the center is the best opening.'},{name:'Mira',text:'Welcome to the room 👋'}]
let adminMode = false
const $ = (s) => document.querySelector(s)
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const game = () => games.find(g => g.id === selected) || games[0]
const messages = (list) => list.map(m => `<div class="message"><span class="message-avatar">${esc(m.name[0])}</span><div><strong>${esc(m.name)}</strong><p>${esc(m.text)}</p></div></div>`).join('')
function render() {
 const g = game()
 $('#app').innerHTML = `<div class="app-shell">
 <aside class="sidebar">
  <a class="brand" href="#"><span class="brand-mark">✳</span><span>NIGHTFALL<small>GAME LOUNGE</small></span></a>
  <div class="side-label">PLAY</div><button class="nav-item active">▦ &nbsp; Game lobby</button>
  <button class="nav-item" data-action="new">＋ &nbsp; Create a game</button>
  <div class="side-label side-label-spaced">COMMUNITY</div><button class="nav-item" data-action="public">◌ &nbsp; Public chat <i class="online-dot"></i></button>
  <div class="sidebar-bottom"><div class="online-card"><i class="online-dot"></i><span><strong>Community online</strong><small>24 players around</small></span></div>
  <div class="user-card"><div class="avatar">${signedIn ? esc(loginName[0].toUpperCase()) : 'G'}</div><div class="user-details"><strong>${signedIn ? esc(loginName) : 'Guest player'}</strong><small>${signedIn ? 'Signed in (demo)' : 'Browsing as guest'}</small></div><button class="icon-button" data-action="profile">⚙</button></div>
  <button class="outline-button full" data-action="auth">${signedIn ? 'Sign out' : 'Sign in / Register'}</button></div>
 </aside>
 <main class="main-content">
  <header class="topbar"><div><div class="eyebrow">THE ARENA</div><h1>Game lobby <span class="live-pill"><i></i> LIVE</span></h1></div><div class="topbar-actions"><span class="quiet-text">Your next match awaits.</span><button class="primary-button" data-action="new">＋ <span>Create game</span></button></div></header>
  <section class="welcome-banner"><div class="banner-copy"><span class="banner-kicker">A LITTLE STRATEGY. A LOT OF FUN.</span><h2>Make your <em>next move.</em></h2><p>Challenge a friend, join a match, or watch the action unfold.</p><button class="light-button" data-action="new">Start a new game <span>↗</span></button></div><div class="banner-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="floating-x">×</div><div class="floating-o">○</div><div class="mini-board"><b>×</b><i></i><b>○</b><i>○</i><b>×</b><i></i><b>×</b><i></i><b>○</b></div></div></section>
  <div class="section-heading"><div><h2>Open games <span class="count">${games.length}</span></h2><p>Find your next opponent or spectate a match.</p></div><button class="text-button" data-action="refresh">↻ Refresh list</button></div>
  <div class="content-grid"><section class="panel"><div class="panel-heading"><div><h3>Live rooms</h3><p>Public matches from the community</p></div><span class="tiny-live"><i></i> LIVE</span></div>
   <div class="game-list">${games.map(x=>`<button class="game-row ${x.id===selected?'selected':''}" data-game="${x.id}"><span class="game-icon">${x.status==='Waiting'?'◷':'✳'}</span><span class="game-info"><strong>${esc(x.name)}</strong><small>${esc(x.host)} · ${x.viewers} watching</small></span><span class="status ${x.status==='Waiting'?'waiting':'playing'}">${esc(x.status)}</span></button>`).join('')}</div>
   <div class="panel-footer"><span>Showing ${games.length} public rooms</span><button class="text-button" data-action="new">Create room ↗</button></div></section>
   <section class="panel match-panel"><div class="panel-heading"><div><h3>Match preview</h3><p>Selected room details</p></div><span class="room-id">#${esc(g.id)}</span></div><div class="match-title"><div class="match-symbol">${g.symbol==='X'?'×':'○'}</div><div><h3>${esc(g.name)}</h3><p>Hosted by <strong>${esc(g.host)}</strong></p></div></div>
   <div class="match-meta"><span>ROOM STATUS</span><strong>${esc(g.status)}</strong><span>WATCHING</span><strong>${g.viewers} spectators</strong></div><div class="mini-board-large">${Array.from({length:9},(_,i)=>`<span class="${i%4===0?'mark-x':i%5===0?'mark-o':''}">${i%4===0?'×':i%5===0?'○':''}</span>`).join('')}</div><button class="primary-button full" data-action="join">${g.status==='Waiting'?'Join this game':'Watch match'} <span>→</span></button></section></div>
  <div class="section-heading lower-heading"><div><h2>Inside the room</h2><p>Follow the conversation while the game unfolds.</p></div></div>
  <div class="content-grid chat-grid"><section class="panel chat-panel"><div class="panel-heading"><div><h3>Players chat <span class="lock">♙</span></h3><p>Private chat for match participants</p></div><span class="chat-count">2 players</span></div><div class="messages">${messages(playersMessages)}</div><form class="chat-form" data-chat="players"><input name="message" placeholder="Message the players…" maxlength="300" required><button aria-label="Send message">↑</button></form></section>
  <section class="panel chat-panel"><div class="panel-heading"><div><h3>Public chat <span class="public-icon">◎</span></h3><p>Chat with players and spectators</p></div><span class="chat-count"><i class="online-dot"></i> Open</span></div><div class="messages">${messages(publicMessages)}</div><form class="chat-form" data-chat="public"><input name="message" placeholder="Say something to everyone…" maxlength="300" required><button aria-label="Send message">↑</button></form></section></div>
  <footer class="footer"><span>✳ NIGHTFALL GAME LOUNGE</span><span>Prototype preview · Firebase not connected</span></footer>
 </main></div><div id="modal-root"></div>${adminMode?'<div class="admin-strip"><strong>DEMO ADMIN TOOLS</strong><span>Illustrative only; no secure admin authorization.</span><button data-action="stop">Stop selected game</button><button data-action="delete">Delete selected game</button><button data-action="admin">Close</button></div>':''}`
}
function toast(text){let n=$('.toast');if(n)n.remove();n=document.createElement('div');n.className='toast';n.textContent=text;document.body.append(n);setTimeout(()=>n.remove(),2600)}
function modal(title, fields, action='Continue'){ $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal"><button class="modal-close" data-action="close">×</button><div class="eyebrow">NIGHTFALL ACCOUNT</div><h2>${title}</h2>${fields}<div class="modal-actions"><button class="outline-button" data-action="close">Cancel</button><button class="primary-button" data-action="submit">${action}</button></div></section></div>`}
$('#app').addEventListener('click',e=>{
 const b=e.target.closest('[data-action],[data-game],[data-cell]');if(!b)return
 if(b.dataset.game){selected=b.dataset.game;board=Array(9).fill('');turn='X';render();return}
 if(b.dataset.cell!==undefined){let i=+b.dataset.cell;if(board[i])return;board[i]=turn;turn=turn==='X'?'O':'X';render();toast(`Demo move placed. ${turn}'s turn.`);return}
 switch(b.dataset.action){
 case 'new': if(!signedIn)return modal('Sign in to create a room','<p class="modal-copy">Sign in to host a public match.</p><label>Login<input name="login" placeholder="Your login"></label><label>Password<input name="password" type="password" placeholder="Password"></label><p class="form-note">Demo only — credentials are not sent or saved.</p>','Sign in');modal('Create a game','<label>Room name<input name="roomName" value="Friendly match"></label><label>Choose your symbol<select name="symbol"><option value="X">X — first move</option><option value="O">O — second move</option></select></label><p class="form-note">Room appears in this local demo only.</p>','Create room');break
 case 'auth':if(signedIn){signedIn=false;render();toast('Signed out of demo session.')}else modal('Welcome back','<label>Login or email<input name="login" placeholder="you@example.com"></label><label>Password<input name="password" type="password"></label><p class="form-note">Demo mode: no real account is created.</p>','Sign in');break
 case 'profile':if(!signedIn)return toast('Sign in first to edit your profile.');modal('Edit profile',`<label>Login<input name="profileLogin" value="${esc(loginName)}"></label><label>Full name<input name="fullName" value=""></label><label>Email<input name="email" type="email" value=""></label><label>Avatar URL<input name="avatar" placeholder="https://…"></label><p class="form-note">Demo only. Real profile storage requires Firebase.</p>`,'Save profile');break
 case 'join':if(!signedIn)return toast('Sign in to join a match. Spectating is available in preview.');toast('Firebase multiplayer is not connected.');break
 case 'refresh':render();toast('Demo room list refreshed.');break
 case 'public':document.querySelector('.chat-grid')?.scrollIntoView({behavior:'smooth'});break
 case 'close':$('#modal-root').innerHTML='';break
 case 'submit':submitModal();break
 case 'admin':adminMode=false;render();break
 case 'stop':if(game())game().status='Stopped';render();toast('Demo game marked stopped.');break
 case 'delete':{let idx=games.findIndex(x=>x.id===selected);if(idx>=0)games.splice(idx,1);if(!games.length)games.push({id:'NEW1',name:'No active rooms',host:'System',symbol:'X',status:'Waiting',viewers:0});selected=games[0].id;render();toast('Demo room removed.');break}
 }
})
function submitModal(){const m=$('.modal');const val=n=>m.querySelector(`[name="${n}"]`)?.value?.trim()||'';const title=m.querySelector('h2').textContent
 if(title.includes('Create a game')){const id=Math.random().toString(36).slice(2,6).toUpperCase();games.unshift({id,name:val('roomName')||'New match',host:loginName,symbol:val('symbol')||'X',status:'Waiting',viewers:0});selected=id;board=Array(9).fill('');$('#modal-root').innerHTML='';render();toast('Demo room created; not online yet.')}
 else if(title.includes('Edit profile')){loginName=val('profileLogin')||loginName;$('#modal-root').innerHTML='';render();toast('Demo profile updated.')}
 else {const login=val('login');if(!login)return toast('Enter a login or email.');signedIn=true;loginName=login.includes('@')?login.split('@')[0]:login;$('#modal-root').innerHTML='';render();toast('Demo session started; Firebase auth is not connected.')}}
$('#app').addEventListener('submit',e=>{const f=e.target.closest('form[data-chat]');if(!f)return;e.preventDefault();const text=f.elements.message.value.trim();if(!text)return;const item={name:signedIn?loginName:'Guest',text};(f.dataset.chat==='players'?playersMessages:publicMessages).push(item);render();toast('Message added to local demo.')})
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal-root').innerHTML='';if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='a'){adminMode=!adminMode;render();if(adminMode)toast('Demo admin panel opened.')}})
render()
