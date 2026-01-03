const m=require("mongoose");
module.exports=m.model("Room",new m.Schema({
 name:{type:String,unique:true},
 private:Boolean,
 members:[String]
}));
