const s=io();
const u=prompt("user");
const r=prompt("room");
s.emit("join",{user:u,room:r});
const c=document.getElementById("chat");
document.getElementById("i").onkeydown=e=>{
 if(e.key==="Enter"){s.emit("msg",e.target.value);e.target.value="";}
};
s.on("history",m=>m.forEach(x=>add(x)));
s.on("msg",add);
function add(m){c.innerHTML+=`<div>${m.user}: ${m.text}</div>`;}
