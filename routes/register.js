const express = require("express");

const { register } = require("../controllers/registerController.js");
const validation = require("../middlewares/validations/registerValidation");
const validator = require("../middlewares/validations/validator");
console.log("register route");
const router = express.Router();
router.route("/register").post(validation, validator, register);



module.exports = router;
