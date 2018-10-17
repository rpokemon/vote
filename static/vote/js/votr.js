const getForm = (key) =>
    `#question_form_${key}`;

const getSelector = (key) =>
    $(`${getForm(key)} >:first-child`).attr('data-selector');

const getResponseType = (key) =>
    $(getForm(key)).attr('data-response-type');

const getDisplayType = (key) =>
    $(getForm(key)).attr('data-display-as');

const respond = (key, ans, path) => {
    var responseObject = { q: key, a: ans };
    $.ajax({
        url: `${path}/response`,
        type: 'POST',
        data: JSON.stringify(responseObject),
        contentType: 'application/json; charset=utf-8',
        success: (data, text, jqXHR) => console.log(`Server accepted response for q${key}`),
        error: (jqXHR, textStatus, errorThrown) => console.log(`Server rejected response for q${key} - ${errorThrown}`)
    });
};

const canMoveNextQuestion = (obj) => {
    var key = obj.attr('data-key');
    var buttonId = `#question_next_${key}`;
    var response = $(`${getForm(key)} ${getSelector(key)}`).val();

    if (response  !== undefined) {
        $(buttonId).removeAttr('disabled');
    } else {
        $(buttonId).attr('disabled');
    }
}

$(document).ready(function() {

    const path = $('body').attr('data-path');
    const numQs = $('main').find('section').length - 1;
    const qPct = 100.0 / numQs;
    var currentProgressValue = 0.0;
    var activeQuestionPanel = $('section:first-of-type');

    $('.question_input').change(function(e) {
        canMoveNextQuestion($(this).parents('.question_form').first());
    });

    $('.next-section').click(function(e) {
        if (currentProgressValue < 100) currentProgressValue += qPct;
        $('#progress').css('width', `${currentProgressValue}%`);

        activeQuestionPanel = $(this).parents('section').next();
        $('body').scrollTo(activeQuestionPanel, 1000, { easing: 'easeInOutQuint' });
    });

    $('.prev-section').click(function(e) {
        if (currentProgressValue > 0) currentProgressValue -= qPct;
        $('#progress').css('width', `${currentProgressValue}%`);

        activeQuestionPanel = $(this).parents('section').prev();        
        $('body').scrollTo(activeQuestionPanel, 1000, { easing: 'easeInOutQuint' });
    });

    $('.record-response').click(function(e) {
        var key = $(this).attr('data-key');

        var respType = getResponseType(key);
        var displayAs = getDisplayType(key);
        var selector = getSelector(key);

        if (!selector)
        {
            console.log(`Warning! No response selector defined for '${respType}' as '${displayAs}'`);
            setResponse(key, 'ERR_NO_SELECTOR');
            return;
        }

        var selection = $(`${getForm(key)} ${selector}`);
        var response = undefined;
        switch (selection.length) {
            case 0:
                console.log("Warning, no response selected where one was expected - server will reject this!");
                break;
            case 1:
                response = selection.val();
                break;
            default:
                response = [];
                selection.each((e,o) => {
                    response.push(o.value);
                });
                break;
        }

        // response should only ever be undefined in the event that user clicks next having not provided a response
        // note that, when skipping, we insert null instead
        if (response === undefined)
            response = 'ERR_REQUIRED_RESPONSE_NOT_GIVEN';

        respond(key, response, path);
    });

    $('.skip-response').click(function(e) {
        var key = $(this).attr('data-key');
        respond(key, null, path);
    });

    $('.finalise-survey').click(function(e) {
        $.ajax({
            url: `${path}/complete`,
            type: 'POST',
            success: () => {
                $('#submissionResponseModalTitle').html("Responses Received!");
                $('#submissionResponseModalMessage').html("That's that, all done! We've received your responses to this survey and they have been stored securely. For security reasons your session will be ended.");
                $('#submissionResponseModal').modal('show');
            },
            error: (jqXHR, textStatus) => {
                $('#submissionResponseModalTitle').html("Something Went Wrong...");

                var errStr = "";
                switch(jqXHR.status) {
                    case 400:
                        errStr = "The response table was incorrectly formed. This likely indicates a bug in the software and should be reported to the r/Pokemon team (400 BAD REQUEST).";
                        break;
                    case 401:
                        errStr = "Our server does not have a record of your session authorisation, indicating you have either already completed this survey or have clicked 'decline' when asked to authorise your account (401 UNAUTHORIZED).";
                        break;
                    case 409:
                        errStr = "The response table was too short, too long, or contained response entries that do not match the required type or format (409 CONFLICT).";
                    default:
                        errStr = `Unknown failure (${jqXHR.status} ${textStatus.toUpperCase()}).`;
                        break;
                }

                $('#submissionResponseModalMessage').html(`Unfortunately an issue occured during transmission of your responses: ${errStr}`);
                $('#submissionResponseModal').modal('show');
            }
        })
    });
    
    var resizeTimeout;
    $(window).resize(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            $('body').scrollTo(activeQuestionPanel, 0);
        }, 50);
    });
});
