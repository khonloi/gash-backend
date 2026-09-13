import { Request, Response } from 'express';
import authService from '../services/authService.js';

export class AuthController {
  async requestOtp(req: Request, res: Response) {
    try {
      const result = await authService.requestOtp(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async verifyOtp(req: Request, res: Response) {
    try {
      const result = await authService.verifyOtp(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  async refreshAccessToken(req: Request, res: Response) {
    try {
      const result = await authService.refreshAccessToken(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const result = await authService.googleLogin(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }



  async resetPassword(req: Request, res: Response) {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async checkStatus(req: Request, res: Response) {
    res.status(200).json({ message: 'Account is active' });
  }
}

export default new AuthController();
