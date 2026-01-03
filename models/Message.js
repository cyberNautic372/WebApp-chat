const m=require("mongoose");
const s=new m.Schema({
 user:String,
 room:String,
 text:String,
 created:{type:Date,default:Date.now}
});
s.index({room:1,created:-1});
module.exports=m.model("Message",s);
