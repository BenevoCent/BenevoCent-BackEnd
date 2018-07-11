app.get('/accounts', function(request, response, next) {
    // Retrieve high-level account information and account and routing numbers
    // for each account associated with the Item.
    client.getAuth(ACCESS_TOKEN, function(error, authResponse) {
      if (error !== null) {
        let msg = 'Unable to pull accounts from the Plaid API.'
        console.log(msg + '\n' + error)
        return response.json({
          error: msg
        })
      }
  
      console.log(authResponse.accounts)
      response.json({
        error: false,
        accounts: authResponse.accounts,
        numbers: authResponse.numbers,
      })
    })
  })
  
  app.post('/item', function(request, response, next) {
    // Pull the Item - this includes information about available products,
    // billed products, webhook information, and more.
    client.getItem(ACCESS_TOKEN, function(error, itemResponse) {
      if (error !== null) {
        console.log(JSON.stringify(error))
        return response.json({
          error: error
        })
      }
  
      // Also pull information about the institution
      client.getInstitutionById(itemResponse.item.institution_id, function(err, instRes) {
        if (err !== null) {
          let msg = 'Unable to pull institution information from the Plaid API.'
          console.log(msg + '\n' + error)
          return response.json({
            error: msg
          })
        } else {
          response.json({
            item: itemResponse.item,
            institution: instRes.institution,
          })
        }
      })
    })
  })
  
  
  app.post('/transactions', function(request, response, next) {
    // Pull transactions for the Item for the last 30 days
    let startDate = moment().subtract(30, 'days').format('YYYY-MM-DD')
    let endDate = moment().format('YYYY-MM-DD')
    client.getTransactions(ACCESS_TOKEN, startDate, endDate, {
      count: 250,
      offset: 0,
    }, function(error, transactionsResponse) {
      if (error !== null) {
        console.log(JSON.stringify(error))
        return response.json({
          error: error
        })
      }
      addBulkTransactions(transactionsResponse, request.body.uid)
  
      response.json(transactionsResponse)
    })
  })
  