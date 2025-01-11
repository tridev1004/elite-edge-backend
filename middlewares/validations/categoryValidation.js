const {query,param,body,check}=require("express-validator");


  
exports.postValidation=[
    body("name").isString().withMessage('name must be string'),

]

exports.updateValidation=[
    body("id").isMongoId().withMessage('Invalid ObjectId'),
    body("name").optional().isString().withMessage('name must be string'),
]

exports.deleteValidation=[
    body("id").isMongoId().withMessage('Invalid ObjectId'), 
]

exports.idValidation=[
    param("id").isMongoId().withMessage('Invalid ObjectId'), 
]

module.exports.searchValidation=[
  query("search").isString().withMessage("search must be string"),
]