const Favorites = require('../models/Favorites');
const mongoose = require('mongoose');

async function addFavoriteService(pro_id, acc_id) {
  if (!pro_id) {
    const err = new Error('Product ID is required');
    err.status = 400;
    throw err;
  }
  if (!mongoose.isValidObjectId(pro_id)) {
    const err = new Error('Invalid product ID');
    err.status = 400;
    throw err;
  }
  const existingFavorite = await Favorites.findOne({ acc_id, pro_id });
  if (existingFavorite) {
    const err = new Error('Product already in favorites');
    err.status = 400;
    throw err;
  }
  const favorite = new Favorites({ acc_id, pro_id });
  return await favorite.save();
}

async function getFavoritesService(acc_id) {
  return await Favorites.find({ acc_id }).populate({
    path: 'pro_id',
    populate: [
      { path: 'productVariantIds', model: 'newProductVariants' },
      { path: 'productImageIds', model: 'newProductImages' }
    ]
  });
}

async function deleteFavoriteService(favoriteId, acc_id) {
  if (!mongoose.isValidObjectId(favoriteId)) {
    const err = new Error('Invalid favorite ID');
    err.status = 400;
    throw err;
  }
  const favorite = await Favorites.findOneAndDelete({ _id: favoriteId, acc_id });
  if (!favorite) {
    const err = new Error('Favorite not found or not authorized');
    err.status = 404;
    throw err;
  }
  return { message: 'Product removed from favorites successfully' };
}

module.exports = {
  addFavoriteService,
  getFavoritesService,
  deleteFavoriteService
};