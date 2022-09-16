import express from "express";


declare global {
    namespace Express {

        
    //   export export interface NextFunction extends express.NextFunction {}
    //     export interface Request extends express.Request {
    //         params: {}
    //         body: {}
    //         query: {}
    //     }
        
    //     export interface Response extends express.Response {
    //         success?: (json: {status: number, data: {}, count?: number}) => void
    //         error?: (json: {status: number, errors: [any]}) => void
    //     }
    }
  }

  declare module 'express-serve-static-core' {
    interface Request {
        params: {}
        body: {}
        query: {}
    }

    interface Response  {
        success?: (json: {status: number, data: {}, count?: number}) => void
        error?: (json: {status: number, errors: [any]}) => void
    }
}