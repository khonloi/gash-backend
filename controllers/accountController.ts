import { Request, Response } from 'express';
import accountService, { AppError } from '../services/accountService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const createAccount = asyncHandler(async (req: Request, res: Response) => {
  const result = await accountService.createAccount(req.body);
  return successResponse(res, 201, result, 'Account created successfully');
});

export const getAllAccounts = asyncHandler(async (req: Request, res: Response) => {
  const result = await accountService.getAllAccounts();
  return successResponse(res, 200, result);
});

export const getAccountById = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;
  const result = await accountService.getAccountById(id, user);
  return successResponse(res, 200, result);
});

export const updateAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;
  const result = await accountService.updateAccount(id, req.body, user);
  return successResponse(res, 200, result, 'Account updated successfully');
});

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;
  const { oldPassword, newPassword } = req.body;
  await accountService.updatePassword(id, oldPassword, newPassword, user);
  return successResponse(res, 200, null, 'Password updated successfully');
});

export const softDeleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;
  await accountService.softDeleteAccount(id, user);
  return successResponse(res, 200, null, 'Account soft deleted successfully');
});

export const getAccountOrderStatistics = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;
  const result = await accountService.getAccountOrderStatistics(id, user);
  return successResponse(res, 200, result);
});
