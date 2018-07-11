app.get('/', function(request, response, next) {
    response.render('index.ejs', {
      PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
      PLAID_ENV: PLAID_ENV,
    })
  })
  
  app.post('/get_access_token', function(request, response, next) {
    PUBLIC_TOKEN = request.body.public_token
    console.log('PUBLIC_TOKEN', PUBLIC_TOKEN)
    client.exchangePublicToken(PUBLIC_TOKEN, function(error, tokenResponse) {
      if (error !== null) {
        let msg = 'Could not exchange public_token!'
        console.log(msg + '\n' + error)
        return response.json({
          error: msg
        })
      }
      ACCESS_TOKEN = tokenResponse.access_token
      ITEM_ID = tokenResponse.item_id
      console.log('Access Token: ' + ACCESS_TOKEN)
      console.log('Item ID: ' + ITEM_ID)
      response.json({
        error: false
      })
    })
  })