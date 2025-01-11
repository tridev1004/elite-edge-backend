const mongoose=require("mongoose");

const schema = new mongoose.Schema({
    _id:{
        type: mongoose.Schema.Types.ObjectId,
        auto: true
      },
    name:{
        type:String,
        required:true
    },
    products_id:{
        type:[mongoose.Schema.Types.ObjectId],
        ref:'products',
        default:[]
    },
    image: [
        {
          src: { type: String, required: true },
          public_id: { type: String, required: true },
        },
      ],
})

mongoose.model("categories",schema);