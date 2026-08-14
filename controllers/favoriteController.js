const favoriteService = require("../services/favoriteService");

exports.addFavorite = async (req, res) => {
  try {
    const savedFavorite = await favoriteService.addFavoriteService(
      req.body.productId,
      req.user.id,
    );

    // Emit Socket.IO event for favorite update
    const io = req.app.get("io");
    if (io && req.user.id) {
      io.to(req.user.id.toString()).emit("favoriteUpdated", {
        action: "added",
        accountId: req.user.id,
      });
    }

    res.status(201).json({
      message: "Product added to favorites successfully",
      favorite: savedFavorite,
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.message || "Error adding to favorites" });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const favorites = await favoriteService.getFavoritesService(req.user.id);
    res.status(200).json(favorites);
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.message || "Error retrieving favorites" });
  }
};

exports.deleteFavorite = async (req, res) => {
  try {
    const result = await favoriteService.deleteFavoriteService(
      req.params.id,
      req.user.id,
    );

    // Emit Socket.IO event for favorite update
    const io = req.app.get("io");
    if (io && req.user.id) {
      io.to(req.user.id.toString()).emit("favoriteUpdated", {
        action: "deleted",
        accountId: req.user.id,
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.message || "Error removing from favorites" });
  }
};
