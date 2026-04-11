// src/Context/Profile/ProfileReducer.js
//
// Improvements over previous version:
//   - UPDATE_PROFILE: shallow-merges a subset of profile fields for optimistic
//     updates (e.g. avatar URL after upload) without a full server round-trip.
//   - SET_LOADING: explicit loading flag action so callers can set it
//     independently of a fetch result.
//   - CLEAR_PROFILE: resets the entire slice to initialState on logout.
//   - All cases use Object.assign-style spread (no mutation) for correctness.

import {
  GET_PROFILE,
  PROFILE_ERROR,
  HANDLE_CHANGE,
  SET_FORMDATA,
  SET_LOADING,
  UPDATE_PROFILE,
  CLEAR_PROFILE,
} from './types';

export const initialProfileState = {
  profile:  null,
  loading:  true,
  error:    null,
  formData: {
    dob:          '',
    currentcity:  '',
    hometown:     '',
    sex:          '',
    relationship: '',
  },
};

const ProfileReducer = (state, action) => {
  switch (action.type) {

    case GET_PROFILE:
      return {
        ...state,
        profile:  action.payload,
        loading:  false,
        error:    null,
      };

    // Shallow-merge a partial profile update (e.g. avatar URL, coverImage)
    // without overwriting fields that haven't changed.
    case UPDATE_PROFILE:
      return {
        ...state,
        profile: state.profile
          ? { ...state.profile, ...action.payload }
          : action.payload,
        loading: false,
        error:   null,
      };

    case PROFILE_ERROR:
      return {
        ...state,
        error:   action.payload,
        loading: false,
      };

    case SET_LOADING:
      return {
        ...state,
        loading: Boolean(action.payload),
      };

    case HANDLE_CHANGE:
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.payload.name]: action.payload.value,
        },
      };

    case SET_FORMDATA:
      return {
        ...state,
        formData: { ...state.formData, ...action.payload },
      };

    case CLEAR_PROFILE:
      return { ...initialProfileState, loading: false };

    default:
      return state;
  }
};

export default ProfileReducer;