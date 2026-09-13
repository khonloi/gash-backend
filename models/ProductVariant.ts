import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IProductVariant extends Document {
  productId: Types.ObjectId;
  productColorId: Types.ObjectId;
  productSizeId: Types.ObjectId;
  variantImage: string;
  variantPrice: number;
  stockQuantity: number;
  variantStatus: 'active' | 'inactive' | 'discontinued';
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Products',
    required: true
  },
  productColorId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductColors',
    required: true
  },
  productSizeId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductSizes',
    required: true
  },
  variantImage: {
    type: String,
    required: true
  },
  variantPrice: {
    type: Number,
    required: [true, 'Variant price is required'],
    min: [0, 'Variant price cannot be negative']
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative']
  },
  variantStatus: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  }
}, {
  timestamps: true
});

const ProductVariant: Model<IProductVariant> = mongoose.model<IProductVariant>('ProductVariants', ProductVariantSchema);

export default ProductVariant;

// Ensure CommonJS interop
// @ts-ignore
module.exports = ProductVariant;
// @ts-ignore
module.exports.default = ProductVariant;
