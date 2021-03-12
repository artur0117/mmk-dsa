import { api } from '..';

const ENDPOINT = '/custom/user/exist';
const METHOD = 'userExist()';

interface EmailOrPhone {
  email?: string, 
  phone?: string
}

/**
 * Returns true if the Agent/User with email or phone already exists
 */
export async function userExistByAxios({ email, phone }: EmailOrPhone) {
  const payload = {
    email,
    phone
  }
  try {
    const res = await api.axios.post(ENDPOINT, payload);
    return Boolean(res?.data?.exist);
  } catch (error) {
    console.error(METHOD, error);
  }
  return null;
}

export default userExistByAxios;
