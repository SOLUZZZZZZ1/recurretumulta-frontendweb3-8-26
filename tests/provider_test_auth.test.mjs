import test from 'node:test';import assert from 'node:assert/strict';
import {validateOpsAuthStatus,isCaseworkProfile} from '../src/ops-auth/opsAuthApi.js';
const status={ok:true,individual_login_enabled:true,configuration_valid:true,shared_ops_login_accepted:false,
  auth_environment:'staging',auth_profile:'provider_test_casework',casework_only:true,local_only:false,
  staging_only:true,payment_mode:'test',device_logout_contract:'rtm_device_logout_v1'};
test('explicit TEST profile opens scoped OPS and keeps closure protection',()=>{
  const result=validateOpsAuthStatus(status);assert.equal(result.authEnvironment,'staging');
  assert.equal(result.paymentMode,'test');assert.ok(isCaseworkProfile(result.authProfile));
});
test('a malformed TEST envelope cannot fall back to generic staging',()=>{
  for(const override of [{payment_mode:'live'},{auth_environment:'production'},{casework_only:false},
    {device_logout_contract:undefined},{local_only:true},{staging_only:false}])assert.throws(()=>validateOpsAuthStatus({...status,...override}));
});
test('production and older staging retain their existing identities',()=>{
  assert.equal(validateOpsAuthStatus({...status,auth_environment:'production',auth_profile:'production_casework',staging_only:false}).authProfile,'production_casework');
  const old={...status};delete old.auth_profile;delete old.casework_only;delete old.device_logout_contract;
  assert.equal(validateOpsAuthStatus(old).authProfile,undefined);assert.equal(isCaseworkProfile(undefined),false);
});
