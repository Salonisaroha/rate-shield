export const environment = {
  production: false,
  apiUrl: (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? `http://${window.location.hostname}:8080`
    : 'http://localhost:8080'
};
