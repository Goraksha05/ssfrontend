// src/Context/Profile/types.js
// Action type constants for ProfileReducer.
// Using string constants (not Symbols) so React DevTools can display them.

export const GET_PROFILE     = 'GET_PROFILE';
export const PROFILE_ERROR   = 'PROFILE_ERROR';
export const HANDLE_CHANGE   = 'HANDLE_CHANGE';
export const SET_FORMDATA    = 'SET_FORMDATA';
export const SET_LOADING     = 'SET_LOADING';
export const UPDATE_PROFILE  = 'UPDATE_PROFILE';   // optimistic patch of a subset of fields
export const CLEAR_PROFILE   = 'CLEAR_PROFILE';    // on logout