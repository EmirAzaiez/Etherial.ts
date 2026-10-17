import etherial from 'etherial';
import { EtherialYup } from 'etherial/components/http/yup.validator';
// The forms are built at import, before the leaf has its config: the password policy
// is read when a request is validated. Without one, the strong password rule applies.
const passwordField = () => EtherialYup.string()
    .required()
    .test('password_policy', 'Password is not strong enough', function (value) {
    var _a;
    if (!value) {
        return true;
    }
    const policy = (_a = etherial.eth_user_leaf) === null || _a === void 0 ? void 0 : _a.config.password_policy;
    if (!policy) {
        return EtherialYup.string().shouldBeStrongPassword().isValidSync(value);
    }
    if (value.length < policy.min_length) {
        return this.createError({ message: `Password must be at least ${policy.min_length} characters` });
    }
    return true;
});
export const UpdatePasswordForm = EtherialYup.object({
    current_password: EtherialYup.string().required(),
    new_password: passwordField(),
}).required();
export const PasswordResetRequestForm = EtherialYup.object({
    email: EtherialYup.string().email().required(),
}).required();
export const PasswordResetConfirmForm = EtherialYup.object({
    email: EtherialYup.string().email().required(),
    token: EtherialYup.string().required(),
    new_password: passwordField(),
}).required();
export const EmailValidationSendForm = EtherialYup.object({}).required();
export const EmailValidationConfirmForm = EtherialYup.object({
    token: EtherialYup.string().required(),
}).required();
export const UpdateBioForm = EtherialYup.object({
    bio: EtherialYup.string().required(),
}).required();
export const CreatePasswordForm = EtherialYup.object({
    password: passwordField(),
}).required();
export const UpdateAvatarForm = EtherialYup.object({
    avatar: EtherialYup.string()
        // .shouldBeS3File(S3FoldersKeys.USER_AVATAR, 'Avatar must be a valid file')
        .required(),
}).required();
