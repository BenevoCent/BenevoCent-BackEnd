function generateDonation(amount){

    amount = +amount
    if (amount < 0 || amount % 1 === 0) return 0
    return +((1 - (amount % 1)).toFixed(2))
  
}
  
  
function addBulkTransactions(transactions, uid) {
  
    let filteredData = transactions.transactions.map(transaction => {
    if (+transaction.amount % 1 === 0){
        transaction.amount = 0.01 + transaction.amount
    }
    if (+transaction.amount < 0){
        transaction.amount = +transaction.amount * -1
    }
      return transaction
    })
  
    let monthArr = {}
  
    filteredData.forEach(transaction => {
  
    let data = {
        account_id: transaction.account_id,
        amount: transaction.amount,
        date: transaction.date,
        name: transaction.name,
        donation: generateDonation(transaction.amount)
    }
  
    let month = data.date.substring(0, 7)

    if (!monthArr[month]) monthArr[month] = true
  
    return db
        .collection(`all_transactions`)
        .doc(uid)
        .collection(`user_transactions`)
        .doc(transaction.transaction_id)
        .set(data)
    })
  
    bulkUpdateMonthlyDonations(monthArr, uid)
  
}
  
  
function addSingleTransaction(body){
  
    let data = {
        account_id: body.account_id,
        amount: body.amount,
        date: body.date,
        name: body.name,
        donation: generateDonation(body.amount)
    }
  
    singleUpdateMonthlyDonations(data.date.substring(0, 7), body.userUid, data.donation)
  
  
    db.collection(`all_transactions`)
        .doc(`${body.userUid}`)
        .collection('user_transactions')
        .doc(body.transaction_id)
        .set(data)
  
    return data
  
}
