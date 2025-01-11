const mongoose = require("mongoose");
require("../models/categorySchema");

const { getDataOfPage } = require("./paginationController");
const Category = mongoose.model("categories");
const cloudinary = require('cloudinary').v2;


module.exports.getAllCategory = (request, response, next) => {
    Category.find({})
        .then((data) => {
            // handle pagination
            const page = request.query.page ? request.query.page : 1;
            const { totalPages, pageData } = getDataOfPage(data, page);
            response.status(200).json({
                data: pageData,
                totalPages,
                totalCategories: data.length,
                allData:data
            });
        })
        .catch((error) => next(error));
};


module.exports.getCategoryById = (request, response, next) => {

    Category.findOne({ _id: request.params.id })
        .then((obj) => {
            if (obj === null) {
                throw new Error("Category isn't found");
            }
            response.status(200).json(obj);
        })
        .catch((error) => next(error));
}

module.exports.addCategory =async (req, res, next) => {

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No images provided for upload." });
      }
      
    
      const uploadedImages = await Promise.all(
        req.files.map((file) =>
          cloudinary.uploader.upload(file.path, { folder: "category" })
        )
      );
    
      // Extract Cloudinary URLs
      const imagesArr = uploadedImages.map((img) => ({
        src: img.secure_url,
        public_id: img.public_id, // Save public_id for easier management (deletion, updates)
      }));
    

    let object = new Category({
        name: req.body.name,
        image:imagesArr
    });
    object.save()
        .then(data => {
            res.status(201).json(data)
        }).catch(error => next(error));
}

module.exports.updateCategory = (request, response, next) => {
    const imagePath = request.file ? request.file.path : request.data;
    Category.updateOne({ _id: request.body.id },
        {
            $set: {
                name: request.body.name,
                image: imagePath
            }
        })
        .then((data) => {
            response.status(200).json(data);
        }).catch((error) => next(error))
}

module.exports.deleteCategory = (request, response, next) => {
    Category.findOne({ _id: request.body.id })
        .then((category) => {
            if (!category) {
                throw new Error('Category not found with the specified _id value');
            }
            return Category.deleteOne({ _id: request.body.id })
        }).then(data => {
            response.status(200).json(data);
        }).catch(error => next(error));
}

module.exports.searchForCategory = (req, res, next) => {
    Category.find()
      .then((data) => {
        const arr = data.filter((ele) => {
          return (
            ele.name.toLowerCase().includes(req.query.search.toLowerCase()) ||
            ele._id.toString().toLowerCase().includes(req.query.search.toLowerCase())
          );
        });
        return arr;
      })
      .then((data) => {
        const page = req.query.page ? req.query.page : 1;
        const { totalPages, pageData } = getDataOfPage(data, page);
        res.status(200).json({
          data: pageData,
          totalPages,
          totalCategories: data.length,
        });
      })
      .catch((error) => next(error));
  };
