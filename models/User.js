const m=require("mongoose");
const s=new m.Schema({username:{type:String,unique:true,index:true},password:String});
module.exports=m.model("User",s);
