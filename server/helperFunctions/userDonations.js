function bulkUpdateMonthlyDonations(monthArr, uid){

    let promiseArr = []
    let donationArr = []
    let transactionCol = db.collection('all_transactions').doc(uid).collection(`user_transactions`)
    let donationCol = db.collection('all_donations').doc(uid).collection(`user_donations`)
  
    monthArr = Object.keys(monthArr)
  
    monthArr.forEach((month, index) => {
  
        transactionCol.where('date', '>', monthArr[index]).where('date', '<', `${monthArr[index]}-32`)
        .get()
        .then(snapshot => {
            let donation = 0
            snapshot.forEach(doc => {
                donation += doc.data().donation
            })
            return donation
        })
        .then(donation => {

            donationCol.doc(monthArr[index])
            .set({totalDonations: +(donation.toFixed(2))})

            updateTotalDonations(donation, uid)
            distributeMoney(donation, uid)

        })
    })
}
  
function singleUpdateMonthlyDonations(month, uid, donation){


    let monthDoc = db.collection('all_donations')
        .doc(uid)
        .collection(`user_donations`)
        .doc(month)

    monthDoc.get()
    .then(snapshot => {
        let monthlyDonation = snapshot.data() ? snapshot.data().totalDonations + +(donation) : +(donation)

        monthDoc.set({totalDonations: +(monthlyDonation.toFixed(2))})
    })

    updateTotalDonations(donation, uid)
    distributeMoney(donation, uid)

}
  
  
function updateTotalDonations(donation, uid){

    let userDoc = db.collection('users').doc(uid)

    db.runTransaction(t => {
        return t.get(userDoc)
            .then(doc => {
                let newDonationAmount =  doc.data().totalDonations ? +(doc.data().totalDonations) + +(donation) : +(donation)
                newDonationAmount = +(newDonationAmount.toFixed(2))
                t.update(userDoc, { totalDonations: newDonationAmount })
            })
    })

}
