const express = require("express");

const validations = require("../middlewares/validations/categoryValidation");
const validator = require("../middlewares/validations/validator");
const controller = require("../controllers/categoryController");
const authMW =require("./../middlewares/authMw");
const upload = require("../utils/cloudinary.config");

const router = express.Router();



router
  .route("/categories")
  .get(controller.getAllCategory)
  .post(authMW.verifyToken,authMW.isAdmin,upload.array("image",5),validations.postValidation,validator,controller.addCategory)
  .patch(authMW.verifyToken,authMW.isAdmin,upload.array('image'),validations.updateValidation,validator,controller.updateCategory)
  .delete(authMW.verifyToken,authMW.isAdmin,validations.deleteValidation,validator,controller.deleteCategory)

  router
  .route("/categories/search")
  .get(validations.searchValidation,validator,controller.searchForCategory) 
   
  router
  .route("/categories/:id")
  .get(validations.idValidation, validator, controller.getCategoryById);

module.exports = router;