import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (t: string) => void;
  reject: (e: any) => void;
}> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalReq = error.config;

    if (error.response?.status === 401 && !originalReq._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalReq.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalReq));
            },
            reject,
          });
        });
      }

      originalReq._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync("refresh_token");
        const { data } = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/auth/refresh`,
          {
            refreshToken,
          },
        );

        await SecureStore.setItemAsync("access_token", data.accessToken);
        await SecureStore.setItemAsync("refresh_token", data.refreshToken);

        failedQueue.forEach((p) => p.resolve(data.accessToken));
        failedQueue = [];

        originalReq.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalReq);
      } catch (refreshErr) {
        failedQueue.forEach((p) => p.reject(refreshErr));
        failedQueue = [];
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
