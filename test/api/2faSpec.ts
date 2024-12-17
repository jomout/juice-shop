/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby');
import config from 'config';
import jwt from 'jsonwebtoken';
const Joi = frisby.Joi;
const security = require('../../lib/insecurity');
import otplib from 'otplib';

const REST_URL = 'http://localhost:3000/rest';
const API_URL = 'http://localhost:3000/api';
const jsonHeader = { 'content-type': 'application/json' };

async function login({ email, password, totpSecret }: { email: string; password: string; totpSecret?: string }) {
  const loginRes = await frisby
    .post(REST_URL + '/user/login', { email, password })
    .catch((res: any) => {
      if (res.json?.type && res.json.status === 'totp_token_required') return res;
      throw new Error(`Failed to login '${email}'`);
    });

  if (loginRes.json?.status === 'totp_token_required') {
    const totpRes = await frisby.post(REST_URL + '/2fa/verify', {
      tmpToken: loginRes.json.data.tmpToken,
      totpToken: otplib.authenticator.generate(totpSecret),
    });

    return totpRes.json.authentication;
  }
  return loginRes.json.authentication;
}

async function register({ email, password, totpSecret }: { email: string; password: string; totpSecret?: string }) {
  const res = await frisby
    .post(API_URL + '/Users/', {
      email,
      password,
      passwordRepeat: password,
      securityQuestion: null,
      securityAnswer: null,
    })
    .catch(() => {
      throw new Error(`Failed to register '${email}'`);
    });

  if (totpSecret) {
    const { token } = await login({ email, password });

    await frisby.post(REST_URL + '/2fa/setup', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: {
        password,
        setupToken: security.authorize({ secret: totpSecret, type: 'totp_setup_secret' }),
        initialToken: otplib.authenticator.generate(totpSecret),
      },
    });
  }
  return res;
}

function getStatus(token: string) {
  return frisby.get(REST_URL + '/2fa/status', {
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  });
}

describe('/rest/2fa/verify', () => {
  it('POST should return valid authentication with correct tmp token and TOTP', async () => {
    const tmpToken = security.authorize({ userId: 10, type: 'password_valid_needs_second_factor_token' });
    const totpToken = otplib.authenticator.generate('IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH');

    await frisby.post(REST_URL + '/2fa/verify', {
      headers: jsonHeader,
      body: { tmpToken, totpToken },
    })
      .expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .expect('jsonTypes', 'authentication', { token: Joi.string(), umail: Joi.string(), bid: Joi.number() })
      .expect('json', 'authentication', { umail: `wurstbrot@${config.get<string>('application.domain')}` });
  });

  it('POST should fail with an invalid TOTP token', async () => {
    const tmpToken = security.authorize({ userId: 10, type: 'password_valid_needs_second_factor_token' });
    const totpToken = otplib.authenticator.generate('INVALIDSECRET');

    await frisby.post(REST_URL + '/2fa/verify', {
      headers: jsonHeader,
      body: { tmpToken, totpToken },
    }).expect('status', 401);
  });

  it('POST should fail with an unsigned tmp token', async () => {
    const tmpToken = jwt.sign({ userId: 10, type: 'password_valid_needs_second_factor_token' }, 'invalid_key');
    const totpToken = otplib.authenticator.generate('IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH');

    await frisby.post(REST_URL + '/2fa/verify', {
      headers: jsonHeader,
      body: { tmpToken, totpToken },
    }).expect('status', 401);
  });
});

describe('/rest/2fa/status', () => {
  it('GET should indicate 2FA is enabled for accounts with 2FA', async () => {
    const { token } = await login({
      email: `wurstbrot@${config.get<string>('application.domain')}`,
      password: 'EinBelegtesBrotMitSchinkenSCHINKEN!',
      totpSecret: 'IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH',
    });

    await getStatus(token).expect('status', 200).expect('json', { setup: true });
  });

  it('GET should indicate 2FA is not enabled for accounts without 2FA', async () => {
    const { token } = await login({
      email: `J12934@${config.get<string>('application.domain')}`,
      password: '0Y8rMnww$*9VFYE§59-!Fg1L6t&6lB',
    });

    await getStatus(token)
      .expect('status', 200)
      .expect('json', { setup: false, email: `J12934@${config.get<string>('application.domain')}` });
  });

  it('GET should return 401 when not authenticated', async () => {
    await frisby.get(REST_URL + '/2fa/status').expect('status', 401);
  });
});

describe('/rest/2fa/setup', () => {
  it('POST should enable 2FA for accounts without 2FA', async () => {
    const email = 'fooooo1@bar.com';
    const password = '123456';
    const secret = 'ASDVAJSDUASZGDIADBJS';

    await register({ email, password });
    const { token } = await login({ email, password });

    await frisby.post(REST_URL + '/2fa/setup', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: {
        password,
        setupToken: security.authorize({ secret, type: 'totp_setup_secret' }),
        initialToken: otplib.authenticator.generate(secret),
      },
    }).expect('status', 200);

    await getStatus(token).expect('json', { setup: true });
  });
});

describe('/rest/2fa/disable', () => {
  it('POST should disable 2FA for accounts with 2FA', async () => {
    const email = 'fooooodisable1@bar.com';
    const password = '123456';
    const totpSecret = 'ASDVAJSDUASZGDIADBJS';

    await register({ email, password, totpSecret });
    const { token } = await login({ email, password, totpSecret });

    await getStatus(token).expect('json', { setup: true });

    await frisby.post(REST_URL + '/2fa/disable', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: { password },
    }).expect('status', 200);

    await getStatus(token).expect('json', { setup: false });
  });
});
