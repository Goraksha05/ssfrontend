import { GET_PROFILE, PROFILE_ERROR, HANDLE_CHANGE, SET_FORMDATA } from './types';

const ProfileReducer = (state, action) => {
  switch (action.type) {
    case GET_PROFILE:
      return {
        ...state,
        profile: action.payload,
        loading: false,
      };
    case PROFILE_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false,
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
        formData: action.payload,
      };
    default:
      return state;
  }
};

export default ProfileReducer;
