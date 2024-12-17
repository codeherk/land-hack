// 888                             888 888    888                   888      
// 888                             888 888    888                   888      
// 888                             888 888    888                   888      
// 888       8888b.  88888b.   .d88888 8888888888  8888b.   .d8888b 888  888 
// 888          "88b 888 "88b d88" 888 888    888     "88b d88P"    888 .88P 
// 888      .d888888 888  888 888  888 888    888 .d888888 888      888888K  
// 888      888  888 888  888 Y88b 888 888    888 888  888 Y88b.    888 "88b 
// 88888888 "Y888888 888  888  "Y88888 888    888 "Y888888  "Y8888P 888  888 
                                                                          
                                                                          
// required packages
import fetch from 'node-fetch'
import readline from 'readline'
import * as dotenv from 'dotenv';

dotenv.config();

let preparedURL = "https://phl.carto.com/api/v2/sql?q=" // start to build the URL of api
var api_key = process.env.API_KEY // api key from geocod
let params = [] //array will store parameters to prep the URL with
const limit = 10 // limits the data response. without an response, the query will take a long time to return data

// color for console logging
let FgCyan = "\x1b[36m"
let Reset = "\x1b[0m"

// prints in color
let log = function(msg){
  console.log(FgCyan+'%s'+Reset, msg)
}


// create interface to get user input and display output
let readLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})


// get user input
function readInput(){
  readLine.question('\nEnter first name : ', (firstName) => {
    if (firstName == 'exit') {
      return readLine.close()
    }
    if (firstName == '') {
      log("No name was entered.")
      return readInput()
    }
    if (firstName.indexOf(';') > -1) { //semicolon found, suspected malicious use, scrub/validate input in case api becomes insecure
      log("You have entered unfamilliar input. Please enter only characters and digits.")
      return readInput()
    }

    readLine.question('Enter last name : ', (lastName) => {
      if (lastName == 'exit')
        return readLine.close()
      if (lastName == '') {
        return readInput()
        log("No name was entered.")
      }
      if (lastName.indexOf(';') > -1) { //semicolon found, validate input
        return readInput()
        log("You have entered unfamilliar input. Please enter only characters and digits.")
      }
      firstName = firstName.trim().toUpperCase()
      lastName = lastName.trim().toUpperCase()
      // otherwise, make request
      log("The name you entered was: " + firstName + " " + lastName)
      
      getProperties(lastName + ' ' + firstName).then((result) => {
        // show properties
        logProperties(result)
        // show coordinates for each property
        logCoordinates(result)
        readInput()
        //log(result)
      }, (err) => {
        log(err)
        readInput()
      })
      //readInput()
    })
  })
}


let pushParams = function (params) {
  //input: takes the parameters we want and populates an array with them
  //output: void

  params.push("owner_1")
  params.push("sale_date")
  params.push("sale_price")
  params.push("year_built")
  params.push("location")
}


let prepareStatement = function (params) {
  //input: takes the query parameters array
  //output: returns the formatted SQL statement
  pushParams(params)
  let statement = "SELECT " + params + " FROM opa_properties_public"
  //log("testing statement" + statement)
  return statement
}



/**
 * 
 * @param {*} name 
 * @returns property info and coordinates of all addresses under similar names
 * makes a request to the philadelphia api to get property data
 * and supplies the mailing address it retrieves to a geocoding api in order to get the coordinates
 */
let getProperties = (name) => {

  let coordinates = []
  // add name to query
  let query = `${preparedURL} WHERE owner_1 LIKE '${name}%25' LIMIT 10` // %25 is % .... SQL LIKE operator
  log("testing query: " + query) //debugging
  return fetch(query).then((response) => {
    return response.json().then((data) => data.rows)
  }).catch((err) => {
    return err
  })
}

/**
 * 
 * @param {*} properties given by opendata api
 * prints information requested about property (params elements) such as owner_1, location, etc.
 * prints neatly
 */
let logProperties = function (properties) {
  //log(properties)
  log('\n')
  log('\t'+ properties.length + ' Properties Found')
  log('------------------------------------------------')
  for(let i = 0; i < properties.length; i++){
    // log(properties[i])
    log("Owner: \t" + properties[i].owner_1)
    log("Location: \t" + properties[i].location) 
    log("  built: \t" +properties[i].year_built)   
    log("  sale price: \t" + properties[i].sale_price)
    log("  sale date: \t" + properties[i].sale_date + "\n")
  }
  log('------------------------------------------------') 
}

/**
 * 
 * @param {*} properties given from opendata response
 * prints address and coordinates (lat,lng)
 */
let logCoordinates = function (properties) {
  let allAddressesToGeolocate = []
  //log("\nGELOCATING IF DATA IS AVAILABLE")
  for (let i = 0; i <= properties.length - 1; i++) { //runtime O(n) + whatever getMap is
    allAddressesToGeolocate[i] = properties[i].location
    //log("testing addresses to geolocate: " + allAddressesToGeolocate[i])
    if (allAddressesToGeolocate[i] != "") { //prevent null requests  
      let c = allAddressesToGeolocate[i].charAt(0) //sample the first character 
      //log("testing c: " + c)
      if (c >= 0 && c <= 9) { //if the first character is a number, the address is in the proper format (improper format is 'PO box xyz')
        allAddressesToGeolocate[i] = allAddressesToGeolocate[i].replace(/\s*$/, "") //get rid of whitespaces at the end of the entry
        allAddressesToGeolocate[i] = allAddressesToGeolocate[i] + " PHILADELPHIA PA" //format address for geocoding

        getMap(allAddressesToGeolocate[i]).then(function (result) {
          log('\n')
          log(result[0].formatted_address)
          log('(' + result[0].location.lat +  ',' + result[0].location.lng + ')')
          //log('lat: ' + result[0].location.lat)
          //log('lng: ' + result[0].location.lng)
        }, function (err) {
          log(err)
        })
      }
    }
  }
}

/**
 * 
 * @param {*} addressToFormat a string address with spaces
 * @returns the same address, spaces replaced with '+'
 * helps format the URL for the geocoding api
 */
let formatGeocodingAddress = function (addressToFormat) {
  let formattedAddress = addressToFormat.split(' ').join('+')
  //log("testing formatted address: " + formattedAddress)
  return formattedAddress
}

/**
 * 
 * @param {*} address an address supplied by the philadelphia api 
 * @returns coordinates for address IF available
 */
let getMap = function (address) {
  //if (address != "") { //if the attribute exists in the db for this entry
    //log("testing mailingAddress: " + mailingAddress)
    let geocodeURL = "https://api.geocod.io/v1.3/geocode?q=" + formatGeocodingAddress(address) + "&api_key=" + api_key//process.argv[2] //126a657ce501575c55c35ee2c1156c5c00ae607" //argv[1] if we want to use environment vars
    log("testing geocodeURL: " + geocodeURL)
    
    return fetch(geocodeURL).then((response) => {
      return response.json().then((data) => data.results)
    }).catch((err) => {
        log(err) // Print the error if one occurred
        log('error:', err) // Print the error if one occurred
        return err
    })
}

//*************************************************************************
//prepare the URL and start to retrieve user input

preparedURL = preparedURL.concat(prepareStatement(params))
readInput()
//console.log('\x1b[36m%s\x1b[0m', 'I am cyan')
//*************************************************************************



