/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { environment } from '../../environments/environment'
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { catchError, map } from 'rxjs/operators'

interface Address {
  id: number;
  street: string;
  city: string;
  country: string;
}

interface AddressResponse {
  data: Address[];
}

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly hostServer = environment.hostServer
  private readonly host = this.hostServer + '/api/Addresss'

  constructor (private readonly http: HttpClient) { }

  get () {
    return this.http.get<AddressResponse>(this.host).pipe(map((response) => response.data), catchError((err) => { throw err }))
  }

  getById (id) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return this.http.get<AddressResponse>(`${this.host}/${id}`).pipe(map((response) => response.data), catchError((err: Error) => { throw err }))
  }

  save (params) {
    return this.http.post<AddressResponse>(this.host + '/', params).pipe(map((response) => response.data), catchError((err) => { throw err }))
  }

  put (id, params: Address) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return this.http.put<AddressResponse>(`${this.host}/${id}`, params).pipe(map((response) => response.data), catchError((err) => { throw err }))
  }

  del (id: number) {
    return this.http.delete<AddressResponse>(`${this.host}/${id}`).pipe(map((response) => response.data), catchError((err) => { throw err }))
  }
}
