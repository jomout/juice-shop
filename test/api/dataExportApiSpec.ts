/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby');
import { expect } from '@jest/globals';
import config from 'config';
import path from 'path';
const fs = require('fs');

const jsonHeader = { 'content-type': 'application/json' };
const REST_URL = 'http://localhost:3000/rest';

// Helper function: User Login
const loginUser = (email, password) =>
  frisby.post(`${REST_URL}/user/login`, {
    headers: jsonHeader,
    body: { email, password },
  }).expect('status', 200);

// Helper function: Image CAPTCHA
const fetchCaptcha = (token) =>
  frisby
    .get(`${REST_URL}/image-captcha`, {
      headers: { Authorization: `Bearer ${token}`, ...jsonHeader },
    })
    .expect('status', 200);

// Helper function: Export Data
const exportUserData = (token, body, status = 200) =>
  frisby.post(`${REST_URL}/user/data-export`, {
    headers: { Authorization: `Bearer ${token}`, ...jsonHeader },
    body,
  }).expect('status', status);

// Reusable checks for exported data
const checkExportedData = (parsedData, checks) => {
  for (const [key, value] of Object.entries(checks)) {
    expect(parsedData[key]).toBe(value);
  }
};

describe('/rest/user/data-export', () => {
  it('Export data without CAPTCHA', () => {
    return loginUser('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=')
      .then(({ json: jsonLogin }) =>
        exportUserData(jsonLogin.authentication.token, { format: '1' }).then(({ json }) => {
          const parsedData = JSON.parse(json.userData);
          checkExportedData(parsedData, {
            username: 'bkimminich',
            email: 'bjoern.kimminich@gmail.com',
          });
        })
      );
  });

  it('Export data with CAPTCHA failure', () => {
    return loginUser('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=')
      .then(({ json: jsonLogin }) =>
        fetchCaptcha(jsonLogin.authentication.token).then(() =>
          exportUserData(jsonLogin.authentication.token, { answer: 'AAAAAA', format: 1 }, 401)
        )
      );
  });

  it('Export data with correct CAPTCHA', () => {
    return loginUser('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=')
      .then(({ json: jsonLogin }) =>
        fetchCaptcha(jsonLogin.authentication.token).then(({ json: captchaAnswer }) =>
          exportUserData(jsonLogin.authentication.token, { answer: captchaAnswer.answer, format: 1 }).then(({ json }) => {
            const parsedData = JSON.parse(json.userData);
            checkExportedData(parsedData, {
              username: 'bkimminich',
              email: 'bjoern.kimminich@gmail.com',
            });
          })
        )
      );
  });

  it('Export data including orders', () => {
    return loginUser('amy@' + config.get('application.domain'), 'K1f.....................')
      .then(({ json: jsonLogin }) =>
        frisby.post(`${REST_URL}/basket/4/checkout`, {
          headers: { Authorization: `Bearer ${jsonLogin.authentication.token}`, ...jsonHeader },
        })
          .expect('status', 200)
          .then(() =>
            exportUserData(jsonLogin.authentication.token, { format: '1' }).then(({ json }) => {
              const parsedData = JSON.parse(json.userData);
              checkExportedData(parsedData, {
                email: 'amy@' + config.get('application.domain'),
              });
              expect(parsedData.orders[0].products[0].name).toBe('Raspberry Juice (1000ml)');
            })
          )
      );
  });

  it('Export data including reviews', () => {
    return loginUser('jim@' + config.get('application.domain'), 'ncc-1701').then(({ json: jsonLogin }) =>
      exportUserData(jsonLogin.authentication.token, { format: '1' }).then(({ json }) => {
        const parsedData = JSON.parse(json.userData);
        expect(parsedData.reviews[0].message).toBe(
          'Looks so much better on my uniform than the boring Starfleet symbol.'
        );
      })
    );
  });

  it('Export data including memories', () => {
    const file = path.resolve(__dirname, '../files/validProfileImage.jpg');
    const form = frisby.formData();
    form.append('image', fs.createReadStream(file), 'Valid Image');
    form.append('caption', 'Valid Image');

    return loginUser('jim@' + config.get('application.domain'), 'ncc-1701').then(({ json: jsonLogin }) =>
      frisby
        .post(`${REST_URL}/memories`, {
          headers: { Authorization: `Bearer ${jsonLogin.authentication.token}`, 'Content-Type': form.getHeaders()['content-type'] },
          body: form,
        })
        .expect('status', 200)
        .then(() =>
          exportUserData(jsonLogin.authentication.token, { format: '1' }).then(({ json }) => {
            const parsedData = JSON.parse(json.userData);
            expect(parsedData.memories[0].caption).toBe('Valid Image');
          })
        )
    );
  });
});
