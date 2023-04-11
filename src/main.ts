import axios from 'axios';
import * as http from 'https';

import {log4TSProvider} from './config/LogConfig';
const log = log4TSProvider.getLogger('object.tesla');

/**
 * Implementation of the Tesla API endpoints
 */
export class Tesla {
  private vehicleId: string;
  private refreshToken: string;
  private accessToken = '';

  /**
   * Create new Tesla object
   * @param {string} vehicleId
   * @param {string} refreshToken
   */
  constructor(vehicleId: string, refreshToken: string) {
    this.vehicleId = vehicleId;
    this.refreshToken = refreshToken;
  }

  /**
   * Generate new access token
   * @param {()} callback
   */
  public async generateAccessToken(callback: () => void) {
    log.debug('Try to get new access token');
    axios
        .post('https://auth.tesla.com/oauth2/v3/token', {
          grant_type: 'refresh_token',
          client_id: 'ownerapi',
          refresh_token: this.refreshToken,
          scope: 'openid email offline_access',
        })
        .then((response) => {
          this.accessToken = response.data.access_token;
          log.debug(`new access token generated: ${this.accessToken.slice(0, 10)}...`);
          callback();
        })
        .catch(function(error) {
          log.error(error);
        });
  }

  /**
   * Template for sending get request to the tesla api
   * @param {string} uri
   * @param {(any)} callback
   */
  private async tryGetData(uri: string, callback: (response: any) => void) {
    this.sendGetRequest(
        uri,
        (result) => {
        // Handling status code 200 OK
          callback(result);
        },
        (statusCode) => {
        // Handling errors
          if (statusCode == 401) {
          // expired access token
            this.handleError401(() => {
              this.sendGetRequest(
                  uri,
                  (result) => {
                    // Handling status code 200 OK
                    callback(result);
                  },
                  (statusCode) => {
                    // Handling errors
                    if (statusCode == 401) {
                      // expired access token
                      log.error('Error while sending command: ' + statusCode);
                    } else if (statusCode == 408) {
                      // tesla is asleep
                      this.handleError408(0, () => {
                        this.sendGetRequest(
                            uri,
                            (result) => {
                              // Handling status code 200 OK
                              callback(result);
                            },
                            (statusCode) => {
                              // Handling errors
                              log.error('Error while sending command: ' + statusCode);
                            },
                        );
                      });
                    }
                  },
              );
            });
          } else if (statusCode == 408) {
          // tesla is asleep
            this.handleError408(0, () => {
              this.sendGetRequest(
                  uri,
                  (result) => {
                    // Handling status code 200 OK
                    callback(result);
                  },
                  (statusCode) => {
                    log.error('Error while sending command: ' + statusCode);
                  },
              );
            });
          }
        },
    );
  }

  /**
   * Template for sending post request to the tesla api
   * @param {string} uri
   * @param {any} body
   * @param {(any)} callback
   */
  private async trySendCmd(uri: string, body: any, callback: (response: any) => void) {
    this.sendPostRequest(
        uri,
        body,
        (result) => {
        // Handling status code 200 OK
          callback(result);
        },
        (statusCode) => {
        // Handling errors
          if (statusCode == 401) {
          // expired access token
            this.handleError401(() => {
              this.sendPostRequest(
                  uri,
                  body,
                  (result) => {
                    callback(result);
                  },
                  (code) => {
                    log.error('Error while sending command: ' + code);
                  },
              );
            });
          } else if (statusCode == 408) {
          // tesla is asleep
            this.handleError408(0, () => {
              this.sendPostRequest(
                  uri,
                  body,
                  (result) => {
                    callback(result);
                  },
                  (code) => {
                    log.error('Error while sending command: ' + code);
                  },
              );
            });
          }
        },
    );
  }

  /**
   * Method to send the post request
   * @param {string} uri
   * @param {any} body
   * @param {(any)} callback
   * @param {(number | undefined)} errorCallback
   */
  private async sendPostRequest(uri: string, body: any, callback: (response: any) => void, errorCallback: (statusCode: number | undefined) => void) {
    axios
        .post(`https://owner-api.teslamotors.com/api/1/vehicles/${this.vehicleId}/${uri}`, body, {
          headers: {
            'Authorization': 'Bearer ' + this.accessToken,
            'Content-Type': 'application/json',
          },
        })
        .then((response) => {
          callback(response.data.response);
        })
        .catch((error) => {
          errorCallback(error.response.status);
        });
  }

  /**
   * A Tesla will fall asleep if it hasn't been used for a long time. This function wakes up the Tesla and checks whether it can be reached again. As soon as this is the case, the callback function is called.
   * @param {number} i
   * @param {()} callback
   */
  private async handleError408(i: number, callback: () => void) {
    log.debug(`WakeUp (${i})`);
    this.trySendCmd('wake_up', '', async (result) => {
      if (result.state == 'online') {
        callback();
        return;
      } else {
        await this.sleep(10000);
        if (i < 10) this.handleError408(i + 1, callback);
      }
    });
  }

  /**
   * Helper method
   * @param {number} ms
   * @return {Promise}
   */
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * When trying to access the tesla api with an expired access token, this function will generate a new one and call the callback function when the new token generated.
   * @param {()} callback
   */
  private async handleError401(callback: () => void) {
    this.generateAccessToken(callback);
  }

  /**
   * Executes the GET request to the tesla api
   * @param {string} uri
   * @param {(any)} callback
   * @param {(number | undefined)} errorCallback
   */
  private async sendGetRequest(uri: string, callback: (response: any) => void, errorCallback: (statusCode: number | undefined) => void) {
    const options = {
      host: 'owner-api.teslamotors.com',
      port: 443,
      path: `/api/1/vehicles/${this.vehicleId}/${uri}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
    };

    let result = '';
    const req = http.request(options, (res) => {
      if (res.statusCode != 200) {
        errorCallback(res.statusCode);
        return;
      }

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        result += chunk;
      });

      res.on('end', () => {
        callback(result);
      });
    });

    req.on('error', (e) => {
      log.error(e.toString());
    });

    req.end();
  }

  /**
   * Returns the charge state
   * @description https://www.teslaapi.io/vehicles/state-and-settings#charge-state
   * @param {(any)} callback
   */
  public async getChargeData(callback: (response: any) => void): Promise<void> {
    this.tryGetData('data_request/charge_state', (response) => {
      callback(response);
    });
  }

  /**
   * Returns all vehicle data
   * @description https://www.teslaapi.io/vehicles/state-and-settings#vehicle-data
   * @param {(any)} callback
   */
  public async getVehicleData(callback: (response: any) => void): Promise<void> {
    this.tryGetData('vehicle_data', (response) => {
      callback(response);
    });
  }

  /**
   * Start charging
   * @description https://www.teslaapi.io/vehicles/commands#start-charging
   * @param {(any)} callback
   */
  public async startCharging(callback: (response: any) => void): Promise<void> {
    this.trySendCmd('command/charge_start', '', (response) => {
      callback(response);
    });
  }

  /**
   * Stop charging
   * @description https://www.teslaapi.io/vehicles/commands#stop-charging
   * @param {(any)} callback
   */
  public async stopCharging(callback: (response: any) => void): Promise<void> {
    this.trySendCmd('command/charge_stop', '', (response) => {
      callback(response);
    });
  }

  /**
   * Sets the charging ampere
   * @param {number} amps
   * @param {(any)} callback
   */
  public async setChargingAmps(amps: number, callback: (response: any) => void): Promise<void> {
    this.trySendCmd('command/set_charging_amps', {charging_amps: amps}, (response) => {
      callback(response);
    });
  }
}
