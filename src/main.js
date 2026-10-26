import "./style.css";
import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { ref, push, set, remove, onValue, runTransaction, serverTimestamp } from "firebase/database";

const $ = (s, root = document) => root.querySelector(s);
const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let currentUser = null, rooms = {}, selectedRoomId = null, toastTimer, chatMessages = {}, chatRoomSubscribed = null, unsubscribeChat = null;
const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const ADMIN_EMAIL = "vmsk131uh@gmail.com";
const isAdmin = u => String(u?.email || "").toLowerCase() === ADMIN_EMAIL;
const canDeleteRoom = (room, u) => !!u && !!room && (room.hostUid === u.uid || isAdmin(u));
const nameOf = u => u?.displayName || u?.email?.split("@")[0] || "Guest player";
const roomNow = () => selectedRoomId ? rooms[selectedRoomId] || null : null;
const symbolOf = (r, uid) => r?.players?.X?.uid === uid ? "X" : r?.players?.O?.uid === uid ? "O" : null;

function toast(msg) {
  let n = $(".toast");
  if (!n) { n = document.createElement("div"); n.className = "toast"; document.body.append(n); }
  n.textContent = msg; n.classList.add("visible"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => n.classList.remove("visible"), 2800);
}
function openModal(kind) {
  const content = kind === "auth" ? `
    <div class="eyebrow">YOUR NIGHTFALL ACCOUNT</div><h2 id="modal-title">Welcome back</h2>
    <p class="modal-copy">Sign in or create an account to host and play matches.</p>
    <form id="auth-form" class="modal-form">
      <label>Email address<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
      <label>Password<input name="password" type="password" minlength="6" autocomplete="current-password" placeholder="At least 6 characters" required></label>
      <label class="switch-label"><input name="mode" type="checkbox"> Create a new account</label>
      <label class="signup-only hidden">Display name<input name="displayName" maxlength="40" placeholder="Your player name"></label>
      <button class="primary-button full" type="submit">Sign in</button>
    </form>` : `
    <div class="eyebrow">NEW MATCH</div><h2 id="modal-title">Create a game</h2>
    <p class="modal-copy">Open a room and invite another player to join.</p>
    <form id="create-form" class="modal-form">
      <label>Room name<input name="roomName" maxlength="50" value="Friendly match" required></label>
      <label>Your symbol<select name="symbol"><option value="X">X — first move</option><option value="O">O — second move</option></select></label>
      <button class="primary-button full" type="submit">Create room</button>
    </form>`;
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-close="backdrop"><section class="modal" role="dialog" aria-modal="true"><button class="modal-close" data-close="button" aria-label="Close">×</button>${content}</section></div>`;
}
function closeModal() { $("#modal-root").innerHTML = ""; }

function render() {
  const user = currentUser, room = roomNow(), allEntries = Object.entries(rooms).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0)), entries = user ? allEntries : [];
  const board = Array.isArray(room?.board) ? room.board : Array(9).fill("");
  const mine = symbolOf(room, user?.uid), canDelete = canDeleteRoom(room, user), myTurn = !!room && room.status === "In progress" && room.turn === mine;
  const canJoin = !!user && !!room && room.status === "Waiting" && !mine;
  const finished = room && ["Finished","Draw","Stopped"].includes(room.status);
  const statusText = !room ? "Choose a room or create one" : room.status === "Finished" ? `${room.winner} wins` : room.status === "Draw" ? "Draw game" : room.status === "In progress" ? `${room.turn}'s turn` : room.status;
  const list = !user ? `<div class="empty-state"><div class="empty-mark">⌁</div><strong>Sign in to see live games</strong><p>Register or sign in to browse public rooms, join matches and chat with players.</p><button class="primary-button" data-action="auth">Sign in / Register</button></div>` : entries.length ? entries.map(([id,r])=>`<button class="game-row ${id===selectedRoomId?"selected":""}" data-room="${esc(id)}"><span class="game-icon">${r.status==="Waiting"?"◷":"✳"}</span><span class="game-info"><strong>${esc(r.name||"Friendly match")}</strong><small>${esc(r.hostName||"Player")} · ${esc(r.status||"Waiting")}</small></span><span class="status ${r.status==="Waiting"?"waiting":r.status==="In progress"?"playing":"finished"}">${esc(r.status||"Waiting")}</span></button>`).join("") : `<div class="empty-state"><div class="empty-mark">✳</div><strong>No rooms yet</strong><p>Be the first to open a match.</p><button class="primary-button" data-action="create">Create the first room</button></div>`;
  $("#app").innerHTML = `<div class="app-shell">
    <aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">✳</span><span>NIGHTFALL<small>GAME LOUNGE</small></span></a>
      <div class="side-label">PLAY</div><button class="nav-item active" data-action="lobby">▦ &nbsp; Game lobby</button><button class="nav-item" data-action="create">＋ &nbsp; Create a game</button>
      <div class="side-label side-label-spaced">YOUR ACCOUNT</div><div class="account-card"><div class="avatar">${esc(nameOf(user).slice(0,1).toUpperCase())}</div><div class="user-details"><strong>${esc(nameOf(user))}</strong><small>${user?esc(user.email):"Browsing as guest"}</small></div></div>
      <button class="outline-button full" data-action="auth">${user?"Sign out":"Sign in / Register"}</button><div class="sidebar-note"><span class="online-dot"></span> Firebase connected<br><small>Live rooms update automatically</small></div><div class="sidebar-bottom">✳ NIGHTFALL<span>STRATEGY MEETS SERENITY</span></div>
    </aside>
    <main class="main-content"><header class="topbar"><div><div class="eyebrow">THE ARENA</div><h1>Game lobby <span class="live-pill"><i></i> LIVE</span></h1></div><div class="topbar-actions"><span class="quiet-text">Your next match awaits.</span><button class="primary-button" data-action="create">＋ Create game</button></div></header>
      <section class="welcome-banner"><div class="banner-copy"><span class="banner-kicker">A LITTLE STRATEGY. A LOT OF FUN.</span><h2>Make your <em>next move.</em></h2><p>Challenge a friend and watch every move unfold live.</p><button class="light-button" data-action="create">Start a new game <span>↗</span></button></div><div class="banner-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="floating-x">×</div><div class="floating-o">○</div><div class="art-board"><b>×</b><i></i><b>○</b><i>○</i><b>×</b><i></i><b>×</b><i></i><b>○</b></div></div></section>
      <div class="section-heading"><div><h2>Public rooms <span class="count">${user ? entries.length : "—"}</span></h2><p>${user ? "Rooms created by the community, updated in real time." : "Sign in to browse community rooms."}</p></div>${user ? `<button class="text-button" data-action="refresh">↻ Refresh</button>` : ""}</div>
      <div class="content-grid"><section class="panel"><div class="panel-heading"><div><h3>Live rooms</h3><p>Choose a room to view its board</p></div><span class="tiny-live"><i></i> LIVE</span></div><div class="game-list">${list}</div><div class="panel-footer"><span>${user ? `${entries.length} public room${entries.length===1?"":"s"}` : "Account required"}</span>${user ? `<button class="text-button" data-action="create">Create room ↗</button>` : ""}</div></section>
      <section class="panel match-panel"><div class="panel-heading"><div><h3>Match room</h3><p>${room?`Room #${esc(selectedRoomId.slice(-6).toUpperCase())}`:"Select a public room"}</p></div><span class="tiny-live"><i></i> ${room?"SYNCED":"READY"}</span></div>
      ${room?`<div class="match-title"><div class="match-symbol">${room.symbol==="O"?"○":"×"}</div><div><h3>${esc(room.name||"Friendly match")}</h3><p>Hosted by <strong>${esc(room.hostName||"Player")}</strong></p></div></div>
      <div class="player-strip"><div><span class="player-dot x-dot">X</span><span><strong>${esc(room.players?.X?.name||"Waiting…")}</strong><small>Player X</small></span></div><div class="versus">VS</div><div><span class="player-dot o-dot">O</span><span><strong>${esc(room.players?.O?.name||"Waiting…")}</strong><small>Player O</small></span></div></div>
      <div class="board-wrap"><div class="live-board">${board.map((m,i)=>`<button class="board-cell ${m==="X"?"cell-x":m==="O"?"cell-o":""}" data-cell="${i}" ${!myTurn||m||finished?"disabled":""} aria-label="Cell ${i+1}">${m==="X"?"×":m==="O"?"○":""}</button>`).join("")}</div></div>
      <p class="board-status">${esc(statusText)}${mine?` · You are ${mine}`:""}</p><div class="match-actions">${canDelete?`<button class="danger-button" data-action="delete-room">Delete game</button>`:""}${canJoin?`<button class="primary-button full" data-action="join">Join as ${room.players?.X?"O":"X"} →</button>`:mine&&room.status==="In progress"?`<div class="turn-hint">${myTurn?"It's your turn. Make a move.":"Waiting for your opponent…"}</div>`:`<div class="turn-hint">${esc(statusText)}</div>`}</div>
      <section class="room-chat"><div class="chat-heading"><div><h3>Room chat</h3><p>Talk with your opponent while you play.</p></div><span class="chat-live"><i></i> LIVE</span></div>
      ${user && mine ? `<div class="chat-messages" id="chat-messages">${Object.entries(chatMessages).sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0)).map(([mid,m])=>`<div class="chat-message"><strong>${esc(m.name||"Player")}</strong><p>${esc(m.text||"")}</p><small>${m.createdAt?new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"Just now"}</small></div>`).join("") || `<div class="chat-empty">No messages yet. Say hello!</div>`}</div><form id="chat-form" class="chat-form"><input name="message" maxlength="500" placeholder="Write a message…" autocomplete="off" required><button class="primary-button" type="submit" aria-label="Send message">Send ↗</button></form>` : `<div class="chat-locked">${user ? "Join this room to participate in chat." : "Sign in and join a room to use chat."}</div>`}</section>
      `:`<div class="empty-match"><div class="empty-mark">× <span>○</span></div><h3>Your next match starts here.</h3><p>Pick a room from the lobby or create your own.</p><button class="primary-button" data-action="create">Create a game</button></div>`}</section></div>
      <footer class="footer"><span>✳ NIGHTFALL GAME LOUNGE</span><span>Built for the next move.</span></footer></main></div>`;
}

async function createRoom(form) {
  if (!currentUser) return openModal("auth");
  const data = new FormData(form), symbol = data.get("symbol")==="O"?"O":"X", name = String(data.get("roomName")||"Friendly match").trim().slice(0,50);
  const newRef = push(ref(db,"games"));
  try {
    await set(newRef,{name:name||"Friendly match",hostUid:currentUser.uid,hostName:nameOf(currentUser),symbol,status:"Waiting",board:Array(9).fill(""),turn:"X",players:{[symbol]:{uid:currentUser.uid,name:nameOf(currentUser)}},createdAt:serverTimestamp()});
    selectedRoomId = newRef.key; closeModal(); render(); toast("Room created. Invite another player to join!");
  } catch(e) { console.error(e); toast("Could not create room. Check Firebase database rules."); }
}
async function joinRoom() {
  if (!currentUser) return openModal("auth");
  if (!selectedRoomId) return toast("Select a room first.");
  const id = selectedRoomId;
  try {
    const result = await runTransaction(ref(db,`games/${id}`), room => {
      if (!room || room.status!=="Waiting") return;
      room.players ||= {};
      if (room.players.X?.uid===currentUser.uid || room.players.O?.uid===currentUser.uid) return;
      const slot = room.players.X ? "O" : "X";
      if (room.players[slot]) return;
      room.players[slot] = {uid:currentUser.uid,name:nameOf(currentUser)};
      if (room.players.X && room.players.O) room.status="In progress";
      room.board ||= Array(9).fill(""); room.turn="X";
      return room;
    });
    toast(result.committed?"You joined the room!":"This room is no longer available.");
  } catch(e) { console.error(e); toast("Could not join. Check database rules."); }
}
async function deleteRoom() {
  const room = roomNow();
  if (!currentUser || !selectedRoomId || !canDeleteRoom(room, currentUser)) {
    toast("Only the room creator or admin can delete this game.");
    return;
  }
  const roomName = room?.name || "this game";
  if (!window.confirm(`Delete “${roomName}”? This removes the room and its chat permanently.`)) return;
  const id = selectedRoomId;
  try {
    await remove(ref(db, `games/${id}`));
    if (selectedRoomId === id) selectedRoomId = null;
    chatMessages = {};
    subscribeToChat(null);
    render();
    toast("Game deleted.");
  } catch (err) {
    console.error(err);
    toast("Could not delete this game. Check your Realtime Database rules.");
  }
}

async function makeMove(index) {
  if (!currentUser || !selectedRoomId) return;
  try {
    const result = await runTransaction(ref(db,`games/${selectedRoomId}`), room => {
      if (!room || room.status!=="In progress") return;
      const symbol=room.turn||"X";
      if (room.players?.[symbol]?.uid!==currentUser.uid) return;
      const board=Array.isArray(room.board)?[...room.board]:Array(9).fill("");
      if (board[index]) return;
      board[index]=symbol; room.board=board;
      if (wins.some(line=>line.every(i=>board[i]===symbol))) {room.status="Finished";room.winner=symbol;}
      else if (board.every(Boolean)) {room.status="Draw";room.winner=null;}
      else room.turn=symbol==="X"?"O":"X";
      return room;
    });
    if(!result.committed) toast("It's not your turn, or that square is taken.");
  } catch(e) { console.error(e); toast("Could not save move. Check database rules."); }
}

$("#app").addEventListener("click", async e => {
  const b=e.target.closest("[data-action],[data-room],[data-cell]"); if(!b)return;
  if(b.hasAttribute("data-room")){selectedRoomId=b.dataset.room;chatMessages={};subscribeToChat(selectedRoomId);render();return;}
  if(b.hasAttribute("data-cell")){await makeMove(Number(b.dataset.cell));return;}
  switch(b.dataset.action){
    case "create": if(!currentUser)openModal("auth");else openModal("create");break;
    case "auth": if(currentUser){try{await signOut(auth);toast("Signed out.");}catch(err){toast(err.message);}}else openModal("auth");break;
    case "join": await joinRoom();break;
    case "delete-room": await deleteRoom();break;
    case "refresh": render();toast("Lobby refreshed.");break;
    case "lobby": window.scrollTo({top:0,behavior:"smooth"});break;
  }
});
$("#app").addEventListener("submit", async e => {
  if (e.target.id !== "chat-form") return;
  e.preventDefault();
  const form = e.target, button = form.querySelector('button[type="submit"]'), input = form.elements.message;
  const message = String(input.value || "").trim();
  if (!message || !currentUser || !selectedRoomId) return;
  const room = roomNow();
  if (!symbolOf(room,currentUser.uid)) { toast("Join this room before chatting."); return; }
  if (button) button.disabled = true;
  try {
    await push(ref(db,`games/${selectedRoomId}/messages`), {uid:currentUser.uid,name:nameOf(currentUser),text:message,createdAt:Date.now()});
    input.value = "";
  } catch (err) { console.error(err); toast("Message could not be sent. Check database rules."); }
  finally { if (button?.isConnected) button.disabled = false; }
});
$("#modal-root").addEventListener("click",e=>{if(e.target.dataset.close==="backdrop"||e.target.dataset.close==="button")closeModal();});
$("#modal-root").addEventListener("change",e=>{
  if(e.target.name!=="mode")return;
  const signup=e.target.checked;$(".signup-only")?.classList.toggle("hidden",!signup);
  $("#modal-title").textContent=signup?"Create your account":"Welcome back";
  const button=$("#auth-form button[type=submit]");if(button)button.textContent=signup?"Create account":"Sign in";
});
$("#modal-root").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.target,button=form.querySelector('button[type="submit"]');
  if(button){button.disabled=true;button.textContent="Please wait…";}
  try{
    if(form.id==="chat-form"){
      if(!currentUser || !selectedRoomId) throw new Error("Sign in and select a room first.");
      const room = roomNow();
      if(!symbolOf(room,currentUser.uid)) throw new Error("Join this room before chatting.");
      const input=form.elements.message, message=String(input.value||"").trim();
      if(!message) return;
      await push(ref(db,`games/${selectedRoomId}/messages`),{uid:currentUser.uid,name:nameOf(currentUser),text:message,createdAt:Date.now()});
      input.value=""; return;
    }
    if(form.id==="create-form"){await createRoom(form);return;}
    if(form.id==="auth-form"){
      const data=new FormData(form),email=String(data.get("email")||"").trim(),password=String(data.get("password")||""),signup=data.get("mode")==="on";
      if(signup){const displayName=String(data.get("displayName")||"").trim();if(!displayName)throw new Error("Please enter a display name.");const cred=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(cred.user,{displayName});toast("Account created successfully!");}
      else {await signInWithEmailAndPassword(auth,email,password);toast("Signed in successfully!");}
      closeModal();
    }
  }catch(err){
    console.error(err);const friendly={"auth/email-already-in-use":"An account already exists for this email.","auth/invalid-email":"Enter a valid email address.","auth/weak-password":"Choose a password with at least 6 characters.","auth/invalid-credential":"Incorrect email or password.","auth/too-many-requests":"Too many attempts. Try again later.","auth/network-request-failed":"Network error. Check your connection."};
    toast(friendly[err.code]||err.message||"Something went wrong.");
  }finally{if(button?.isConnected){button.disabled=false;button.textContent=form.id==="create-form"?"Create room":"Sign in";}}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
function subscribeToChat(roomId) {
  if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
  chatRoomSubscribed = roomId;
  chatMessages = {};
  if (!roomId) return;
  unsubscribeChat = onValue(ref(db,`games/${roomId}/messages`), snapshot => {
    if (chatRoomSubscribed !== roomId) return;
    chatMessages = snapshot.val() || {};
    if (currentUser && symbolOf(rooms[roomId],currentUser.uid)) {
      const box = $("#chat-messages");
      if (box) {
        box.innerHTML = Object.entries(chatMessages).sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0)).map(([mid,m])=>`<div class="chat-message"><strong>${esc(m.name||"Player")}</strong><p>${esc(m.text||"")}</p><small>${m.createdAt?new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"Just now"}</small></div>`).join("") || `<div class="chat-empty">No messages yet. Say hello!</div>`;
        box.scrollTop = box.scrollHeight;
      }
    }
  }, error => { console.error(error); toast("Chat could not load. Check database rules."); });
}
onAuthStateChanged(auth,user=>{currentUser=user;render();});
onValue(ref(db,"games"),snapshot=>{rooms=snapshot.val()||{};if(!selectedRoomId||!rooms[selectedRoomId])selectedRoomId=currentUser?(Object.keys(rooms)[0]||null):null;if(selectedRoomId!==chatRoomSubscribed)subscribeToChat(selectedRoomId);render();},error=>{console.error(error);toast("Could not load rooms. Check database rules.");});
