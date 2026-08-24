const jwt = require('jsonwebtoken');

const generarJWT = ( codigoUsuario, userNameUsuario, correoUsuario, roleUsuario) => {
    return new Promise( ( resolve, reject ) => {
        const payload = {
            codigoUsuario, userNameUsuario, correoUsuario, roleUsuario
        };
        const options = {
            expiresIn: '30d' 
        };
         const SECRET_KEY = process.env.JWT_SECRET
        jwt.sign( payload, SECRET_KEY, options, ( err, token ) => {
            if ( err ) {
                console.log(err);
                reject('No se pudo generar el JWT');
            } else {
                resolve( token );
            }
        });
    });
}


module.exports = {
    generarJWT,
}