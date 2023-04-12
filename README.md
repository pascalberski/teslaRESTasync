# teslaRESTasync

This repo is a simple Tesla REST api implementation in TypeScript.

It includes functions for automatically renewing the access token and waking up the car if it has gone into standby.

## Getting Started
**Install**

    npm i teslarestasync --save

**Sample code in TypeScript**

    import {Tesla} from  'teslarestasync';
    
    const  vehicleId = '5...3';
    const  refreshToken = 'eyJh...45';
    const  tesla = new  Tesla(vehicleId, refreshToken);
    
    tesla.getChargeData((response) => {
	    console.log(response);
    });
    
## Implemented Readings
**getChargeData(callback (response))** This function returns all readings related to charging the car including battery limit, charge miles, charge voltage, charge phases, current, charge management, and battery heater status ([Documentation](https://www.teslaapi.io/vehicles/state-and-settings#charge-state)).



**getVehicleData(callback (response))**
This function returns all the readings of the car ([Documentation](https://www.teslaapi.io/vehicles/state-and-settings#vehicle-data)).


*Implementations of other endpoints will follow*

## Implemented Commands
**startCharging(callback (response))** Starts vehicle charging. Vehicle must be plugged in, have power available, and not at charge limit ([Documentation](https://www.teslaapi.io/vehicles/commands#start-charging)).

**stopCharging(callback (response))**
Stop vehicle charging. Vehicle must be charging ([Documentation](https://www.teslaapi.io/vehicles/commands#stop-charging)).

**setChargingAmps(amps, callback (response))**
Sets the charging ampere.
Amps must be a number and 5 or more.

*Implementations of other endpoints will follow*
