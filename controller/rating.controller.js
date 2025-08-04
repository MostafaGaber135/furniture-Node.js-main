const Rating = require("../models/rating.model.js");
const catchAsync = require("../utils/catchAsync.utils");
const QueryFeatures = require("../utils/queryFeatures.utils.js");
const Product = require('../models/product.models.js'); 
const Order = require('../models/order.models.js');

// إنشاء تقييم
exports.createRating = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { productId, value, comment } = req.body;

  // 1. التحقق أن المستخدم اشترى المنتج
  const order = await Order.findOne({
    userId,
    paymentStatus: "paid",
    "products.productId": productId,
  });

  if (!order) {
    return res.status(403).json({
      message: "You can only rate a product you have purchased and paid for.",
    });
  }

  // 2. التأكد من أن المستخدم لم يقيّم هذا المنتج مسبقًا
  const existing = await Rating.findOne({ userId, productId });
  if (existing) {
    return res.status(400).json({ message: "You have already rated this product." });
  }

  // 3. إنشاء التقييم
  const newRating = await Rating.create({
    userId,
    productId,
    value,
    comment,
  });

  // 4. تحديث متوسط التقييم وعدد التقييمات
  const ratings = await Rating.find({ productId });
  const ratingCount = ratings.length;
  const averageRating =
    ratings.reduce((acc, r) => acc + r.value, 0) / ratingCount;

  const product = await Product.findById(productId);
  if (product && product.variants.length > 0) {
    product.variants[0].averageRating = averageRating;
    product.variants[0].ratingCount = ratingCount;
    await product.save();
  }

  res.status(201).json({
    message: "Rating created with comment",
    rating: newRating,
  });
});
exports.getRatingsForProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user?._id;

  // 1. استرجاع التقييمات لهذا المنتج مع بيانات المستخدم
  const ratings = await Rating.find({ productId }).populate("userId", "image userName"); // ✅ تم إضافة الاسم والصورة

  // 2. التحقق من إمكانية التقييم
  let canRate = false;
  if (userId) {
    const order = await Order.findOne({
      userId,
      paymentStatus: "paid",
      "products.productId": productId,
    });
    const alreadyRated = await Rating.findOne({ userId, productId });
    if (order && !alreadyRated) {
      canRate = true;
    }
  }

  res.status(200).json({
    ratings,
    canRate,
  });
});


exports.getAllRatings = catchAsync(async (req, res) => {
  const totalCount = await Rating.countDocuments();

  const features = new QueryFeatures(
    Rating.find().populate('userId', 'userName email image') 
                .populate('productId', 'variants description brand'), 
    req.query
  )
    .search()
    .filter();
    // .paginate();

  const ratings = await features.query;

  res.status(200).json({
    message: "All ratings",
    totalCount,
    results: ratings.length,
    ratings,
  });
});

exports.getRatingById = catchAsync(async (req, res) => {
  const rating = await Rating.findById(req.params.id)
    .populate('userId', 'name email')
    .populate('productId', 'variants description brand');

  if (!rating)
    return res.status(404).json({ message: "Rating not found" });

  res.status(200).json({
    message: "Rating fetched successfully",
    rating,
    comment: rating.comment, // يظهر الكومنت بشكل منفصل لو حابة
  });
});

exports.deleteRating = catchAsync(async (req, res) => {
  const deleted = await Rating.findByIdAndDelete(req.params.id);

  if (!deleted)
    return res.status(404).json({ message: "Rating not found or already deleted" });

  res.status(200).json({ message: "Rating (and its comment) deleted successfully" });
});

exports.deleteCommentFromRating = catchAsync(async (req, res) => {
  const rating = await Rating.findById(req.params.id);

  if (!rating)
    return res.status(404).json({ message: "Rating not found" });

  rating.comment = {}; // أو { en: "", ar: "" }
  await rating.save();

  res.status(200).json({ message: "Comment removed from rating", rating });
});

// Analytics 

// 1. عدد التقييمات الكلي
exports.getTotalRatings = catchAsync(async (req, res) => {
  const count = await Rating.countDocuments();
  res.status(200).json({ totalRatings: count });
});

// 2. متوسط التقييم العام
exports.getAverageRating = catchAsync(async (req, res) => {
  const result = await Rating.aggregate([
    { $group: { _id: null, avgRating: { $avg: "$value" } } }
  ]);
  res.status(200).json({ averageRating: result[0]?.avgRating.toFixed(2) || 0 });
});

// 3. عدد التقييمات حسب كل قيمة (1 إلى 5)
exports.getRatingDistribution = catchAsync(async (req, res) => {
  const result = await Rating.aggregate([
    {
      $group: {
        _id: "$value",
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  res.status(200).json({ ratingDistribution: result });
});

// 4. المنتجات الأكثر تقييمًا
exports.getMostRatedProducts = catchAsync(async (req, res) => {
  const result = await Rating.aggregate([
    {
      $group: {
        _id: "$productId",
        count: { $sum: 1 },
        avg: { $avg: "$value" }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $project: {
        productId: "$_id",
        count: 1,
        avg: { $round: ["$avg", 1] },
        name: "$product.variants.name",
        image: "$product.variants.image"
      }
    }
  ]);
  res.status(200).json({ topRatedProducts: result });
});

// 5. عدد التقييمات التي تحتوي على تعليق مكتوب
exports.getRatingsWithComments = catchAsync(async (req, res) => {
  const count = await Rating.countDocuments({
    $or: [
      { "comment.en": { $exists: true, $ne: "" } },
      { "comment.ar": { $exists: true, $ne: "" } }
    ]
  });
  res.status(200).json({ ratingsWithComments: count });
});


