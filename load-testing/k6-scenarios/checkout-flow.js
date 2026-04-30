import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },  // ramp up
    { duration: '5m', target: 20 },  // sustained load
    { duration: '1m', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p99<500'],   // SLO: p99 < 500ms
    http_req_failed: ['rate<0.005'],  // SLO: 99.5% success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // Browse homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage loaded': (r) => r.status === 200,
  });
  sleep(1);

  // Browse product
  res = http.get(`${BASE_URL}/product/OLJCESPC7Z`);
  check(res, {
    'product page loaded': (r) => r.status === 200,
  });
  sleep(1);

  // Add to cart
  res = http.post(`${BASE_URL}/cart`, {
    productId: 'OLJCESPC7Z',
    quantity: '1',
  });
  check(res, {
    'added to cart': (r) => r.status === 200,
  });
  sleep(1);

  // View cart
  res = http.get(`${BASE_URL}/cart`);
  check(res, {
    'cart loaded': (r) => r.status === 200,
  });
  sleep(1);
}
