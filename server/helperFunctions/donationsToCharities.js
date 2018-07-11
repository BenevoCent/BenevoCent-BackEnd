function calculateDonationsToCharities(charity, user, donation){


    let donationsToCharityByUser = db.collection('donationsToCharities')
        .doc(charity).collection('donationsToCharity')
        .doc(user)
  
    donationsToCharityByUser.get()
    .then((charityDoc) => {
  
        if (!charityDoc.data()){
            donationsToCharityByUser.set({totalDonations: donation, uid: user})
        } else {

            db.runTransaction(t => {
                return t.get(donationsToCharityByUser)
                    .then(doc => {
                        let newDonationAmount =  doc.data() ? +(doc.data().totalDonations) + donation : donation
                        newDonationAmount = +(newDonationAmount.toFixed(2))
                        t.update(donationsToCharityByUser, { totalDonations: newDonationAmount })
                    })
            })
        }
    })
}
  
function storeUserDonationsToCharities(charity, user, donation){

    let donationByUserDoc = db.collection('donationsFromUsers')
        .doc(user)

    donationByUserDoc.get()
    .then((userDoc) => {

        if (!userDoc.data()){
        donationByUserDoc.set({[charity]: donation})
        } else {

            db.runTransaction(t => {
                return t.get(donationByUserDoc)
                    .then(doc => {
                        let newDonationAmount =  doc.data()[charity] ? +(doc.data()[charity]) + (donation) : +(donation)
                        newDonationAmount = +(newDonationAmount.toFixed(2))
                        t.update(donationByUserDoc, { [charity]: newDonationAmount })
                    })
            })
        }
})

}

function distributeMoney(donation, uid){

    db.collection('distributions').doc(uid).get()
    .then(doc => {
        let keys = Object.keys(doc.data())

        keys.forEach((key) => {
            db.runTransaction(t => {
                return t.get(db.collection('charities').doc(key))
                .then(charityDoc => {
                let existingDonationAmount =  charityDoc.data().totalDonations ? +(charityDoc.data().totalDonations) : 0
                let newDonationAmount = existingDonationAmount + donation * doc.data()[key]
                newDonationAmount = +(newDonationAmount.toFixed(4))
                t.update(db.collection('charities').doc(key), { totalDonations: newDonationAmount })
                calculateDonationsToCharities(key, uid, donation * doc.data()[key])
                storeUserDonationsToCharities(key, uid, donation * doc.data()[key])
                })
            })
        })
    })
}

  
function addDirectDonation(charity, user, amount){

    amount = amount / 100
  
    let date = new Date()
    let month = `${date.getFullYear()}-0${date.getMonth() + 1}`
    singleUpdateMonthlyDonations(month, user, amount)
    calculateDonationsToCharities(charity, user, amount)
    storeUserDonationsToCharities(charity, user, amount)
  
}
