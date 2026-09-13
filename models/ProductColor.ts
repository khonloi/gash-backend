import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IProductColor extends Document {
  color_name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductColorSchema = new Schema<IProductColor>({
  color_name: {
    type: String,
    required: [true, 'Color name is required'],
    minlength: [2, 'Color name must be at least 2 characters'],
    maxlength: [30, 'Color name cannot exceed 30 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

ProductColorSchema.index({ color_name: 1 });

const ProductColor: Model<IProductColor> = mongoose.model<IProductColor>('ProductColors', ProductColorSchema);

export default ProductColor;

// Ensure CommonJS interop
// @ts-ignore
module.exports = ProductColor;
// @ts-ignore
module.exports.default = ProductColor;
